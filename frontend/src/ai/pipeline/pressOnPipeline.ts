import { nailInference } from "../onnx/nailInference";
import { renderDetectionsToCanvas } from "../onnx/postprocessing";
import { handDetector } from "../hand/handDetector";
import { associateNailsToFingers } from "../finger/fingerAssociation";
import { coinCalibration, loadOpenCv } from "../calibration/coinCalibration";
import { measureAndSizeNails } from "../measurement/nailMeasurement";
import { validatePhotoQuality } from "../validation/photoValidation";
import type { PipelineExecutionResult, PipelineProgressInfo } from "../types";
import { normalizeImageFile } from "@/utils/imageNormalizer";

export interface PipelineOptions {
  confidenceThreshold?: number;
  iouThreshold?: number;
  onProgress?: (status: string, progress?: PipelineProgressInfo) => void;
  _internalState?: {
    completedSteps: number[];
    stepBadges: Record<number, string>;
  };
}

export class PressOnPipeline {
  /**
   * Run the end-to-end browser-only AI sizing pipeline on an image File
   */
  public async executeFromFile(
    file: File,
    handSide: "left" | "right" = "right",
    options: PipelineOptions = {}
  ): Promise<PipelineExecutionResult> {
    const completedSteps: number[] = [];
    const stepBadges: Record<number, string> = {};

    const notify = async (
      step: 1 | 2 | 3 | 4 | 5,
      percent: number,
      title: string,
      detail: string,
      badge?: string
    ) => {
      if (badge) stepBadges[step] = badge;
      options.onProgress?.(title, {
        step,
        percent,
        title,
        detail,
        badge: badge || stepBadges[step],
        completedSteps: [...completedSteps],
        stepBadges: { ...stepBadges },
      });
      // Micro-yield for smooth DOM repainting on mobile
      await new Promise((r) => setTimeout(r, 60));
    };

    // Step 1: Photo Optimization & Alignment
    await notify(
      1,
      15,
      "Optimizing photo alignment & quality...",
      "Standardizing resolution and orientation for mobile AI detection"
    );

    const img = await this.loadImageFromFile(file);

    completedSteps.push(1);
    stepBadges[1] = "Photo Optimized";
    await notify(
      1,
      25,
      "Photo alignment verified",
      "Resolution normalized for mobile AI vision",
      "Photo Optimized"
    );

    return this.execute(img, handSide, {
      ...options,
      _internalState: { completedSteps, stepBadges },
    });
  }

  /**
   * Run the end-to-end browser-only AI sizing pipeline on an HTML Image or Canvas
   */
  public async execute(
    img: HTMLImageElement | HTMLCanvasElement,
    handSide: "left" | "right" = "right",
    options: PipelineOptions = {}
  ): Promise<PipelineExecutionResult> {
    const {
      confidenceThreshold = 0.25,
      iouThreshold = 0.45,
      onProgress,
      _internalState,
    } = options;

    const completedSteps: number[] = _internalState?.completedSteps || [1];
    const stepBadges: Record<number, string> = _internalState?.stepBadges || {
      1: "Photo Optimized",
    };

    const notify = async (
      step: 1 | 2 | 3 | 4 | 5,
      percent: number,
      title: string,
      detail: string,
      badge?: string
    ) => {
      if (badge) stepBadges[step] = badge;
      onProgress?.(title, {
        step,
        percent,
        title,
        detail,
        badge: badge || stepBadges[step],
        completedSteps: [...completedSteps],
        stepBadges: { ...stepBadges },
      });
      // Micro-yield so mobile browser repaints each stage
      await new Promise((r) => setTimeout(r, 60));
    };

    const rawW = (img instanceof HTMLImageElement ? img.naturalWidth : img.width) || img.width;
    const rawH = (img instanceof HTMLImageElement ? img.naturalHeight : img.height) || img.height;

    // Safety guard: If image exceeds 1536px, downscale to prevent mobile wasm OOM / CPU freeze
    let targetImg: HTMLImageElement | HTMLCanvasElement = img;
    if (rawW > 1536 || rawH > 1536) {
      const scale = Math.min(1.0, 1536 / Math.max(rawW, rawH));
      const targetW = Math.round(rawW * scale);
      const targetH = Math.round(rawH * scale);

      const normCanvas = document.createElement("canvas");
      normCanvas.width = targetW;
      normCanvas.height = targetH;
      const ctx = normCanvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, targetW, targetH);
        targetImg = normCanvas;
      }
    }

    // Step 2: AI Vision Engine
    await notify(
      2,
      28,
      "Preparing on-device AI vision engine...",
      "Loading local neural vision model in browser"
    );
    await nailInference.loadModel((statusText, stepPct) => {
      onProgress?.("Preparing on-device AI vision engine...", {
        step: 2,
        percent: stepPct ?? 35,
        title: "Preparing on-device AI vision engine...",
        detail: statusText,
        badge: stepBadges[2],
        completedSteps: [...completedSteps],
        stepBadges: { ...stepBadges },
      });
    });
    // Start warming up OpenCV.js cleanly right after ONNX Vision Engine completes (zero bandwidth contention in Step 2)
    void loadOpenCv().catch(() => undefined);
    if (!completedSteps.includes(2)) completedSteps.push(2);
    stepBadges[2] = "AI Engine Ready";
    await notify(
      2,
      45,
      "AI vision engine active",
      "Local neural network running on-device",
      "AI Engine Ready"
    );

    // Step 3: Nail Detection & Segmentation
    await notify(
      3,
      55,
      "Detecting nail contours & boundaries...",
      "Scanning individual nail beds & precision contour masks"
    );
    const {
      detections: rawDetections,
      meta,
      debugInfo,
    } = await nailInference.runInference(
      targetImg,
      confidenceThreshold,
      iouThreshold
    );
    if (!completedSteps.includes(3)) completedSteps.push(3);
    const nailCount = rawDetections.length;
    stepBadges[3] = nailCount > 0 ? `${nailCount} Nails Located` : "Nails Located";
    await notify(
      3,
      70,
      `Detected ${nailCount} nail contour${nailCount === 1 ? "" : "s"}`,
      "Anatomical boundaries mapped successfully",
      stepBadges[3]
    );

    // Step 4: Reference ₹10 Coin Calibration
    await notify(
      4,
      76,
      "Verifying ₹10 reference coin calibration...",
      "Calculating 27.0 mm reference scale for millimeter precision"
    );
    const handLandmarks = await handDetector.detectHand(targetImg, handSide);
    const calibration = await coinCalibration.detectCoin(targetImg, rawDetections, handLandmarks);

    // Filter out a detection ONLY if the YOLO model falsely detected the coin disc itself as a nail
    // (i.e. the detection is concentric with the coin AND large like the coin)
    const filteredDetections = rawDetections.filter((det) => {
      if (calibration.detected && calibration.center && calibration.radius) {
        const [cx, cy] = calibration.center;
        const dist = Math.hypot(det.geometry.centerX - cx, det.geometry.centerY - cy);
        const isConcentricWithCoin = dist < calibration.radius * 0.55;
        const isCoinSized = det.geometry.maxWidthPx > calibration.radius * 1.1;
        if (isConcentricWithCoin && isCoinSized) {
          return false;
        }
      }
      return true;
    });

    if (!completedSteps.includes(4)) completedSteps.push(4);
    stepBadges[4] = calibration.detected
      ? "₹10 Coin Verified (27 mm)"
      : "Scale Calibrated";
    await notify(
      4,
      86,
      calibration.detected ? "₹10 Reference coin verified" : "Measurement scale calibrated",
      calibration.detected ? "27.0 mm coin metric baseline established" : "Metric scale calculated",
      stepBadges[4]
    );

    // Step 5: Precision Sizing & Fit Matching
    await notify(
      5,
      92,
      "Calculating precision press-on sizes...",
      "Matching millimeter contours to custom press-on sizes 0–9"
    );
    const associatedDetections = associateNailsToFingers(
      filteredDetections,
      handSide,
      handLandmarks
    );

    const measuredDetections = measureAndSizeNails(
      associatedDetections,
      calibration
    );

    // Photo Quality & Safety Validation (Rules 3, 4, 5, 6)
    const origW = (targetImg instanceof HTMLImageElement ? targetImg.naturalWidth : targetImg.width) || targetImg.width;
    const origH = (targetImg instanceof HTMLImageElement ? targetImg.naturalHeight : targetImg.height) || targetImg.height;

    const validation = validatePhotoQuality({
      imageWidth: origW,
      imageHeight: origH,
      rawDetections: filteredDetections,
      measuredDetections,
      calibration,
    });

    // Safety: If validation failed, clear out recommended sizes so fake/unreliable sizes are NEVER produced!
    const finalDetections = validation.passed
      ? measuredDetections
      : measuredDetections.map((d) => ({
          ...d,
          recommendedSize: undefined,
        }));

    // Render Visual Overlay
    const overlayCanvas = renderDetectionsToCanvas(
      targetImg,
      finalDetections,
      meta,
      {
        showMasks: true,
        showBoxes: true,
        showLabels: true,
        maskOpacity: 0.45,
        referenceCoin:
          calibration.detected && calibration.center && calibration.radius && calibration.pixelsPerMm
            ? {
                center: calibration.center,
                radius: calibration.radius,
                pixelsPerMm: calibration.pixelsPerMm,
              }
            : null,
      }
    );

    const annotatedImageDataUrl = overlayCanvas.toDataURL("image/jpeg", 0.92);

    if (!completedSteps.includes(5)) completedSteps.push(5);
    stepBadges[5] = "Custom Sizes Ready";
    await notify(
      5,
      100,
      "Analysis complete! Generating size profile...",
      "Finalizing custom Aura Nails fit recommendations",
      "Custom Sizes Ready"
    );

    return {
      success: validation.passed,
      annotatedImageDataUrl,
      detections: finalDetections,
      calibration,
      handLandmarks,
      debugInfo,
      validation,
      error: validation.passed ? undefined : validation.primaryError,
    };
  }

  private async loadImageFromFile(file: File): Promise<HTMLImageElement> {
    const normalizedFile = await normalizeImageFile(file, 1536);
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(normalizedFile);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image file into browser element"));
      };
      img.src = url;
    });
  }
}

export const pressOnPipeline = new PressOnPipeline();
