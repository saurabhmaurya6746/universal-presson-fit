import * as ort from "onnxruntime-web";
import { preprocessImage } from "./preprocessing";
import {
  parseYoloSegmentationOutput,
} from "./postprocessing";
import type {
  NailDetection,
  LetterboxMeta,
  ModelDebugInfo,
} from "../types";

export const MODEL_URL = "/models/best_50epoch.onnx";

const LOCAL_WASM_PATH = "/onnx/";

// Configure WASM paths to purely local assets with explicit timeout
try {
  if (typeof window !== "undefined") {
    // Primary: Same-origin local WASM assets served from /onnx/
    ort.env.wasm.wasmPaths = LOCAL_WASM_PATH;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.initTimeout = 45000; // 45s explicit timeout prevents indefinite hanging
  }
} catch (e) {
  console.warn("[NailInference] Error configuring WASM environment:", e);
}

/**
 * Fetch the ONNX model binary from local static assets with real byte stream progress.
 */
async function fetchModelWithProgress(
  url: string,
  onProgress?: (receivedBytes: number, totalBytes: number) => void
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to load AI model asset from ${url} (HTTP ${response.status} ${response.statusText})`
    );
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body || total === 0) {
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress?.(received, total);
    }
  }

  const combined = new Uint8Array(received);
  let position = 0;
  for (const chunk of chunks) {
    combined.set(chunk, position);
    position += chunk.length;
  }
  return combined;
}

class NailInferenceEngine {
  private session: ort.InferenceSession | null = null;
  private modelLoadPromise: Promise<ort.InferenceSession> | null = null;
  private modelLoadTimeMs = 0;

  public isLoaded(): boolean {
    return this.session !== null;
  }

  public getSession(): ort.InferenceSession | null {
    return this.session;
  }

  /**
   * Load the ONNX model once and cache the InferenceSession
   */
  public async loadModel(
    onStatus?: (status: string) => void
  ): Promise<ort.InferenceSession> {
    if (this.session) {
      return this.session;
    }

    if (this.modelLoadPromise) {
      return this.modelLoadPromise;
    }

    onStatus?.("Initializing AI vision engine...");

    this.modelLoadPromise = (async () => {
      const startTime = performance.now();
      try {
        console.log(`[NailInference] Loading model buffer from ${MODEL_URL}...`);
        onStatus?.("Loading neural vision network...");

        const modelBuffer = await fetchModelWithProgress(MODEL_URL, (received, total) => {
          if (total > 0) {
            const mbReceived = (received / (1024 * 1024)).toFixed(1);
            const mbTotal = (total / (1024 * 1024)).toFixed(1);
            onStatus?.(`Loading neural vision network (${mbReceived} MB / ${mbTotal} MB)...`);
          } else {
            const mbReceived = (received / (1024 * 1024)).toFixed(1);
            onStatus?.(`Loading neural vision network (${mbReceived} MB)...`);
          }
        });

        console.log(`[NailInference] Creating ONNX session from model buffer with local WASM...`);
        onStatus?.("Compiling local on-device neural vision network...");

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
        onStatus?.("AI vision engine ready");
        return this.session;
      } catch (err) {
        this.session = null;
        this.modelLoadPromise = null;
        console.error("[NailInference] Failed to load ONNX model:", err);
        throw new Error(
          `Failed to load ONNX model (${MODEL_URL}): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    })();

    return this.modelLoadPromise;
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
    const session = await this.loadModel(onProgress);

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
