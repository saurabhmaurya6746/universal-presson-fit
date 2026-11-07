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

const CDN_WASM_PATH = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
const LOCAL_WASM_PATH = "/onnx/";

// Configure WASM paths
try {
  if (typeof window !== "undefined") {
    // Primary: jsdelivr CDN recommended for bundlers like Vite to avoid dev-server module transform issues
    ort.env.wasm.wasmPaths = CDN_WASM_PATH;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
  }
} catch (e) {
  console.warn("[NailInference] Error configuring WASM environment:", e);
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
        console.log(`[NailInference] Creating ONNX session from ${MODEL_URL}...`);

        // Primary attempt with CDN wasmPaths
        try {
          this.session = await ort.InferenceSession.create(MODEL_URL, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          });
        } catch (primaryErr) {
          console.warn("[NailInference] Primary WASM path load failed, trying local fallback...", primaryErr);
          // Fallback to local WASM assets
          ort.env.wasm.wasmPaths = LOCAL_WASM_PATH;
          this.session = await ort.InferenceSession.create(MODEL_URL, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          });
        }

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
