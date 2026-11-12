import * as ort from "onnxruntime-web/wasm";
import { preprocessImage } from "./preprocessing";
import { parseYoloSegmentationOutput } from "./postprocessing";
import type {
  NailDetection,
  LetterboxMeta,
  ModelDebugInfo,
} from "../types";

export const MODEL_URL = "/models/best_50epoch.onnx";
const WASM_MJS_URL = "/onnx/ort-wasm-simd-threaded.mjs";
const WASM_BINARY_URL = "/onnx/ort-wasm-simd-threaded.wasm";

// Fallback sizes when CDN/proxy responses use chunked transfer or omit Content-Length
const MODEL_FALLBACK_BYTES = 13_190_964;
const WASM_FALLBACK_BYTES = 14_239_897;
const STALL_TIMEOUT_MS = 25_000;
const WASM_COMPILE_TIMEOUT_MS = 30_000;

export type ModelStatusCallback = (status: string, percent?: number) => void;

// Configure pure WASM execution environment
try {
  if (typeof window !== "undefined") {
    ort.env.wasm.wasmPaths = {
      mjs: WASM_MJS_URL,
      wasm: WASM_BINARY_URL,
    };
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    // Compilation runs against already-downloaded in-memory wasmBinary, so 30s only guards runtime init
    ort.env.wasm.initTimeout = WASM_COMPILE_TIMEOUT_MS;
  }
} catch (e) {
  console.warn("[NailInference] Error configuring WASM environment:", e);
}

function looksLikeHtml(bytes: Uint8Array): boolean {
  if (bytes.byteLength === 0) return false;
  const sampleLen = Math.min(64, bytes.byteLength);
  let text = "";
  for (let i = 0; i < sampleLen; i++) {
    text += String.fromCharCode(bytes[i]);
  }
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html") || trimmed.startsWith("<head");
}

function isValidWasmBinary(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength > 1024 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x73 &&
    bytes[3] === 0x6d
  );
}

/**
 * Fetch a binary asset with real streamed byte progress (even when Content-Length is omitted)
 * and a per-chunk inactivity stall watchdog that resets on every received chunk.
 */
async function fetchBinaryWithProgress(
  url: string,
  fallbackTotalBytes: number,
  expectedType: "onnx" | "wasm",
  onProgress?: (receivedBytes: number, totalBytes: number) => void
): Promise<Uint8Array> {
  const controller = new AbortController();
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const resetStallWatchdog = () => {
    if (stallTimer !== undefined) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, STALL_TIMEOUT_MS);
  };

  try {
    resetStallWatchdog();
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(
        `Failed to load AI asset from ${url} (HTTP ${response.status} ${response.statusText})`
      );
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html")) {
      throw new Error(
        `Received HTML instead of binary AI asset from ${url}. Check static asset routing.`
      );
    }

    const headerLen = parseInt(response.headers.get("content-length") || "0", 10);
    const total = Number.isFinite(headerLen) && headerLen > 0 ? headerLen : fallbackTotalBytes;

    let result: Uint8Array;

    if (!response.body) {
      const arrayBuffer = await response.arrayBuffer();
      result = new Uint8Array(arrayBuffer);
      onProgress?.(result.byteLength, Math.max(total, result.byteLength));
    } else {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        resetStallWatchdog();
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length > 0) {
          chunks.push(value);
          received += value.length;
          onProgress?.(received, Math.max(total, received));
        }
      }

      const combined = new Uint8Array(received);
      let position = 0;
      for (const chunk of chunks) {
        combined.set(chunk, position);
        position += chunk.length;
      }
      result = combined;
    }

    if (result.byteLength <= 1024 || looksLikeHtml(result)) {
      throw new Error(`Downloaded invalid or empty AI asset from ${url}.`);
    }
    if (expectedType === "wasm" && !isValidWasmBinary(result)) {
      throw new Error(`Invalid WebAssembly binary header received from ${url}.`);
    }

    return result;
  } catch (err) {
    if (timedOut) {
      throw new Error(
        `Network stalled while loading ${url} (no data received for ${STALL_TIMEOUT_MS / 1000}s).`
      );
    }
    throw err;
  } finally {
    if (stallTimer !== undefined) clearTimeout(stallTimer);
  }
}

async function fetchBinaryWithRetry(
  url: string,
  fallbackTotalBytes: number,
  expectedType: "onnx" | "wasm",
  onProgress?: (receivedBytes: number, totalBytes: number) => void
): Promise<Uint8Array> {
  try {
    return await fetchBinaryWithProgress(url, fallbackTotalBytes, expectedType, onProgress);
  } catch (firstErr) {
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    if (msg.includes("HTTP 404") || msg.includes("Received HTML") || msg.includes("Invalid WebAssembly")) {
      throw firstErr;
    }
    console.warn(`[NailInference] Retrying fetch for ${url} after transient error:`, msg);
    await new Promise((r) => setTimeout(r, 600));
    return await fetchBinaryWithProgress(url, fallbackTotalBytes, expectedType, onProgress);
  }
}

class NailInferenceEngine {
  private session: ort.InferenceSession | null = null;
  private modelLoadPromise: Promise<ort.InferenceSession> | null = null;
  private cachedModelBuffer: Uint8Array | null = null;
  private cachedWasmBuffer: ArrayBuffer | null = null;
  private modelLoadTimeMs = 0;

  private statusListeners = new Set<ModelStatusCallback>();
  private latestStatus: string | null = null;
  private latestPercent: number | undefined = undefined;

  public isLoaded(): boolean {
    return this.session !== null;
  }

  public getSession(): ort.InferenceSession | null {
    return this.session;
  }

  private emitStatus(status: string, percent?: number): void {
    this.latestStatus = status;
    this.latestPercent = percent;
    for (const listener of this.statusListeners) {
      try {
        listener(status, percent);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  /**
   * Quietly pre-warm the ONNX model and WASM runtime in the background while
   * the user selects hand side / uploads their photo.
   */
  public preload(): Promise<void> {
    if (this.session) return Promise.resolve();
    return this.loadModel().then(
      () => undefined,
      (err) => {
        console.debug("[NailInference] Background preload skipped:", err instanceof Error ? err.message : err);
      }
    );
  }

  /**
   * Load the ONNX model and pure-WASM runtime once (in parallel) and cache the InferenceSession.
   */
  public async loadModel(
    onStatus?: ModelStatusCallback
  ): Promise<ort.InferenceSession> {
    if (this.session) {
      onStatus?.("AI vision engine ready", 45);
      return this.session;
    }

    if (onStatus) {
      this.statusListeners.add(onStatus);
      if (this.latestStatus) {
        onStatus(this.latestStatus, this.latestPercent);
      }
    }

    try {
      if (this.modelLoadPromise) {
        return await this.modelLoadPromise;
      }

      this.emitStatus("Initializing AI vision engine...", 28);

      this.modelLoadPromise = (async () => {
        const startTime = performance.now();
        try {
          console.log(`[NailInference] Loading model & pure-WASM runtime in parallel...`);

          let modelReceived = this.cachedModelBuffer ? this.cachedModelBuffer.byteLength : 0;
          let modelTotal = this.cachedModelBuffer ? this.cachedModelBuffer.byteLength : MODEL_FALLBACK_BYTES;
          let wasmReceived = this.cachedWasmBuffer ? this.cachedWasmBuffer.byteLength : 0;
          let wasmTotal = this.cachedWasmBuffer ? this.cachedWasmBuffer.byteLength : WASM_FALLBACK_BYTES;
          let lastUiEmitMs = 0;

          const reportParallelProgress = (force = false) => {
            const now = performance.now();
            if (!force && now - lastUiEmitMs < 180) return;
            lastUiEmitMs = now;

            const totalReceived = modelReceived + wasmReceived;
            const totalExpected = Math.max(modelTotal + wasmTotal, totalReceived, 1);
            const ratio = Math.min(1, totalReceived / totalExpected);
            const pct = Math.round(28 + ratio * 13); // 28% -> 41% across download
            const mbDone = (totalReceived / (1024 * 1024)).toFixed(1);
            const mbAll = (totalExpected / (1024 * 1024)).toFixed(1);
            const dlPct = Math.round(ratio * 100);

            this.emitStatus(
              `Loading neural vision engine (${mbDone} / ${mbAll} MB · ${dlPct}%)...`,
              pct
            );
          };

          reportParallelProgress(true);

          const [modelBuffer, wasmArrayBuffer] = await Promise.all([
            this.cachedModelBuffer
              ? Promise.resolve(this.cachedModelBuffer)
              : fetchBinaryWithRetry(MODEL_URL, MODEL_FALLBACK_BYTES, "onnx", (rec, tot) => {
                  modelReceived = rec;
                  modelTotal = tot;
                  reportParallelProgress();
                }).then((buf) => {
                  this.cachedModelBuffer = buf;
                  return buf;
                }),
            this.cachedWasmBuffer
              ? Promise.resolve(this.cachedWasmBuffer)
              : fetchBinaryWithRetry(WASM_BINARY_URL, WASM_FALLBACK_BYTES, "wasm", (rec, tot) => {
                  wasmReceived = rec;
                  wasmTotal = tot;
                  reportParallelProgress();
                }).then((buf) => {
                  const rawBuf = buf.buffer.slice(
                    buf.byteOffset,
                    buf.byteOffset + buf.byteLength
                  ) as ArrayBuffer;
                  this.cachedWasmBuffer = rawBuf;
                  return rawBuf;
                }),
          ]);

          reportParallelProgress(true);

          if (typeof window !== "undefined") {
            ort.env.wasm.wasmBinary = wasmArrayBuffer;
          }

          console.log(`[NailInference] Compiling local neural vision network...`);
          this.emitStatus("Compiling & warming up on-device neural network...", 42);
          // Micro-yield so UI repaints 42% before WASM instantiation begins
          await new Promise((r) => setTimeout(r, 30));

          this.session = await ort.InferenceSession.create(modelBuffer, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          });

          this.modelLoadTimeMs = performance.now() - startTime;
          console.log(
            `[NailInference] Model loaded successfully in ${this.modelLoadTimeMs.toFixed(1)} ms. Inputs:`,
            this.session.inputNames,
            "Outputs:",
            this.session.outputNames
          );
          this.emitStatus("AI vision engine ready", 45);
          return this.session;
        } catch (err) {
          this.session = null;
          this.modelLoadPromise = null;
          this.cachedModelBuffer = null;
          this.cachedWasmBuffer = null;
          this.latestStatus = null;
          this.latestPercent = undefined;
          console.error("[NailInference] Failed to load ONNX model:", err);
          const rawMsg = err instanceof Error ? err.message : String(err);
          const friendlyMsg = rawMsg.includes("previous call to 'initializeWebAssembly()' failed")
            ? "Browser WebAssembly runtime failed to initialize. Please close heavy tabs or refresh the page and try again."
            : rawMsg;
          throw new Error(`Failed to load ONNX model (${MODEL_URL}): ${friendlyMsg}`);
        }
      })();

      return await this.modelLoadPromise;
    } finally {
      if (onStatus) {
        this.statusListeners.delete(onStatus);
      }
    }
  }

  /**
   * Run the full nail detection & segmentation inference
   */
  public async runInference(
    img: HTMLImageElement | HTMLCanvasElement,
    confThresh = 0.25,
    iouThresh = 0.45,
    onProgress?: (step: string) => void
  ): Promise<{
    detections: NailDetection[];
    meta: LetterboxMeta;
    debugInfo: ModelDebugInfo;
    rawOutputs: Record<string, ort.Tensor>;
  }> {
    const session = await this.loadModel((status) => onProgress?.(status));

    const totalStart = performance.now();

    // 1. Preprocessing
    onProgress?.("Optimizing image for AI detection...");
    const tPreStart = performance.now();
    const { tensor: inputTensor, meta } = preprocessImage(img, 416, 416);
    const preprocessTimeMs = performance.now() - tPreStart;

    // 2. ONNX Inference
    onProgress?.("Locating nail beds & contour masks...");
    const inputName = session.inputNames[0] || "images";
    const feeds: Record<string, ort.Tensor> = {
      [inputName]: inputTensor,
    };

    const tInferStart = performance.now();
    const rawOutputs = await session.run(feeds);
    const inferenceTimeMs = performance.now() - tInferStart;

    // 3. Postprocessing
    onProgress?.("Refining nail boundaries...");
    const tPostStart = performance.now();
    const detections = parseYoloSegmentationOutput(
      rawOutputs,
      session.outputNames,
      meta,
      confThresh,
      iouThresh
    );
    const postprocessTimeMs = performance.now() - tPostStart;
    const totalTimeMs = performance.now() - totalStart;

    // Extract dynamic input/output shape debug information
    const inputShapes = session.inputNames.map((name) => {
      const t = feeds[name];
      return t ? `[${t.dims.join(",")}]` : "[1,3,416,416]";
    });

    const outputShapes = session.outputNames.map((name) => {
      const t = rawOutputs[name];
      return t ? `${name}: [${t.dims.join(",")}]` : name;
    });

    const debugInfo: ModelDebugInfo = {
      modelName: "best_50epoch.onnx",
      executionProvider: "WASM (single-threaded)",
      inputNames: session.inputNames,
      inputShapes,
      outputNames: session.outputNames,
      outputShapes,
      modelLoadTimeMs: Math.round(this.modelLoadTimeMs),
      preprocessTimeMs: Math.round(preprocessTimeMs * 10) / 10,
      inferenceTimeMs: Math.round(inferenceTimeMs * 10) / 10,
      postprocessTimeMs: Math.round(postprocessTimeMs * 10) / 10,
      totalTimeMs: Math.round(totalTimeMs * 10) / 10,
      numDetections: detections.length,
      confidenceThreshold: confThresh,
      iouThreshold: iouThresh,
    };

    return {
      detections,
      meta,
      debugInfo,
      rawOutputs,
    };
  }
}

export const nailInference = new NailInferenceEngine();
