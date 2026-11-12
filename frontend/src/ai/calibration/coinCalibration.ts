import type {
  CalibrationResult,
  CalibrationCandidateDebug,
  NailDetection,
  HandLandmarkData,
} from "../types";
import {
  refineCoinOuterBoundary,
  type WorkImageBuffers,
} from "./coinBoundaryRefiner";

/**
 * Physical diameter of standard Indian ₹10 coin: 27.00 mm
 * Production-ready 3-pass adaptive calibration engine (Refactored & Verified)
 */
export const REFERENCE_COIN_DIAMETER_MM = 27.0;

const MAX_PROCESSING_DIM = 1280;
const OPENCV_SCRIPT_SRC = "/opencv/opencv.js";
const OPENCV_TIMEOUT_MS = 45_000;
const OPENCV_POLL_INTERVAL_MS = 50;

let openCvModulePromise: Promise<any> | null = null;

type ImageDimensions = {
  width: number;
  height: number;
};

type ScaledCandidate = {
  center: [number, number];
  radius: number;
  diameterPx: number;
  perspectiveNote?: string | null;
};

/**
 * Checks that the OpenCV.js API needed by this detector is available.
 */
function isCvFullyInitialized(cvObj: any): boolean {
  try {
    return Boolean(
      cvObj &&
        typeof cvObj.Mat === "function" &&
        typeof cvObj.cvtColor === "function" &&
        typeof cvObj.GaussianBlur === "function" &&
        typeof cvObj.HoughCircles === "function" &&
        typeof cvObj.imread === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Gets dimensions without referencing browser constructors unless they exist.
 */
function getImageDimensions(img: HTMLImageElement | HTMLCanvasElement): ImageDimensions {
  const isImage =
    typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement;
  const isCanvas =
    typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement;

  const candidate = img as HTMLImageElement & HTMLCanvasElement;

  return {
    width: isImage
      ? candidate.naturalWidth || candidate.width || 0
      : isCanvas
        ? candidate.width || 0
        : candidate?.width || 0,
    height: isImage
      ? candidate.naturalHeight || candidate.height || 0
      : candidate?.height || 0,
  };
}

/**
 * Loads OpenCV.js and waits until its runtime exposes the required API.
 * A failed load clears the cached promise so a later call can retry.
 */
export async function loadOpenCv(): Promise<any> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("OpenCV.js requires a browser environment");
  }

  const currentCv = (window as any).cv;
  if (isCvFullyInitialized(currentCv)) {
    return currentCv;
  }

  if (openCvModulePromise) {
    return openCvModulePromise;
  }

  openCvModulePromise = (async () => {
    let script = document.querySelector(
      'script[src*="opencv.js"]'
    ) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.src = OPENCV_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }

    const resolvedCv = await new Promise<any>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const startedAt = Date.now();

      const cleanup = () => {
        if (timer !== undefined) clearTimeout(timer);
        script?.removeEventListener("error", onError);
      };

      const finish = (error?: Error, cvObj?: any) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve(cvObj);
      };

      const onError = () => {
        finish(new Error(`Failed to load ${OPENCV_SCRIPT_SRC}`));
      };

      script?.addEventListener("error", onError, { once: true });

      const poll = async () => {
        if (settled) return;

        const rawCv = (window as any).cv;

        if (rawCv) {
          try {
            const candidateCv =
              typeof rawCv.then === "function" ? await rawCv : rawCv;

            if (isCvFullyInitialized(candidateCv)) {
              finish(undefined, candidateCv);
              return;
            }
          } catch (error: any) {
            finish(new Error(error?.message || "OpenCV.js initialization failed"));
            return;
          }
        }

        if (Date.now() - startedAt >= OPENCV_TIMEOUT_MS) {
          finish(new Error("Timed out waiting for OpenCV.js initialization"));
          return;
        }

        timer = setTimeout(poll, OPENCV_POLL_INTERVAL_MS);
      };

      void poll();
    });

    return resolvedCv;
  })().catch((error) => {
    openCvModulePromise = null;
    throw error;
  });

  return openCvModulePromise;
}

/**
 * Browser-side ₹10 coin calibration engine.
 *
 * Detection runs on an image capped at 1280px on its longest side. Returned
 * coordinates and diameter are mapped back to the original image dimensions.
 */
export class CoinCalibrationEngine {
  private readonly referenceDiameterMm: number;

  constructor(referenceDiameterMm = REFERENCE_COIN_DIAMETER_MM) {
    this.referenceDiameterMm = referenceDiameterMm;
  }

  public async detectCoin(
    img: HTMLImageElement | HTMLCanvasElement,
    nailDetections: NailDetection[] = [],
    handLandmarks?: HandLandmarkData
  ): Promise<CalibrationResult> {
    const { width: origW, height: origH } = getImageDimensions(img);

    if (origW < 100 || origH < 100) {
      return this.failureResult(
        "Image resolution too low for coin verification",
        "Image resolution too low"
      );
    }

    let cv: any;
    try {
      cv = await loadOpenCv();
    } catch (error: any) {
      const message = error?.message || "Unknown OpenCV.js loading error";
      console.error("[CoinCalibration] Failed to load OpenCV.js:", error);
      return this.failureResult(
        `OpenCV.js runtime failed to load: ${message}`,
        "OpenCV.js runtime unavailable"
      );
    }

    // Use one uniform scale factor to preserve circles as circles.
    const maxOrigDim = Math.max(origW, origH);
    const resizeScale =
      maxOrigDim > MAX_PROCESSING_DIM ? MAX_PROCESSING_DIM / maxOrigDim : 1;
    const workW = Math.max(1, Math.round(origW * resizeScale));
    const workH = Math.max(1, Math.round(origH * resizeScale));

    // Rounding can make the effective X/Y scales differ slightly; keep exact per-axis factors.
    const scaleX = origW / workW;
    const scaleY = origH / workH;

    const matsToDispose: any[] = [];
    const registerMat = (mat: any) => {
      if (mat) matsToDispose.push(mat);
      return mat;
    };
    const debugCandidates: CalibrationCandidateDebug[] = [];

    try {
      if (typeof document === "undefined") {
        throw new Error("DOM document unavailable for canvas operations");
      }

      const canvas = document.createElement("canvas");
      canvas.width = workW;
      canvas.height = workH;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      ctx.drawImage(img as any, 0, 0, workW, workH);

      const src = registerMat(cv.imread(canvas));
      const bgr = registerMat(new cv.Mat());
      cv.cvtColor(src, bgr, cv.COLOR_RGBA2BGR);

      const gray = registerMat(new cv.Mat());
      cv.cvtColor(bgr, gray, cv.COLOR_BGR2GRAY);

      const blurred = registerMat(new cv.Mat());
      cv.GaussianBlur(gray, blurred, new cv.Size(9, 9), 2, 2, cv.BORDER_DEFAULT);

      // Equalize after denoising so uniform background grain is not amplified into spurious Canny edges
      const equalized = registerMat(new cv.Mat());
      cv.equalizeHist(blurred, equalized);

      const eqBlurred = registerMat(new cv.Mat());
      cv.GaussianBlur(
        equalized,
        eqBlurred,
        new cv.Size(5, 5),
        1.2,
        1.2,
        cv.BORDER_DEFAULT
      );

      const lab = registerMat(new cv.Mat());
      cv.cvtColor(bgr, lab, cv.COLOR_BGR2Lab);

      // Light 3x3 smoothing suppresses single-pixel sensor noise without blunting the outer rim
      const graySmooth = registerMat(new cv.Mat());
      cv.GaussianBlur(gray, graySmooth, new cv.Size(3, 3), 0.65, 0.65, cv.BORDER_DEFAULT);

      const sobelX = registerMat(new cv.Mat());
      const sobelY = registerMat(new cv.Mat());
      cv.Sobel(graySmooth, sobelX, cv.CV_64F, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
      cv.Sobel(graySmooth, sobelY, cv.CV_64F, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);

      const numPixels = workH * workW;
      const sxData = sobelX.data64F;
      const syData = sobelY.data64F;
      const gxData = new Float32Array(numPixels);
      const gyData = new Float32Array(numPixels);
      const gradMag = new Float32Array(numPixels);

      for (let i = 0; i < numPixels; i++) {
        const gx = sxData[i];
        const gy = syData[i];
        gxData[i] = gx;
        gyData[i] = gy;
        gradMag[i] = Math.hypot(gx, gy);
      }

      const workBuffers: WorkImageBuffers = {
        width: workW,
        height: workH,
        grayData: gray.data as Uint8Array,
        gxData,
        gyData,
        gradMag,
        labData: lab.data as Uint8Array,
        bgrData: bgr.data as Uint8Array,
      };

      const minDim = Math.min(workH, workW);
      const minRadius = Math.max(16, Math.floor(minDim * 0.025));
      const maxRadius = Math.min(145, Math.floor(minDim * 0.18));

      const searchPasses = [
        { name: "standard", mat: blurred, dp: 1.2, param1: 100, param2: 25, minConf: 0.65 },
        { name: "contrast_boost", mat: eqBlurred, dp: 1.25, param1: 90, param2: 22, minConf: 0.62 },
        { name: "sensitive", mat: eqBlurred, dp: 1.4, param1: 85, param2: 18, minConf: 0.58 },
      ];

      const circles = registerMat(new cv.Mat());

      let bestCandidate:
        | (ScaledCandidate & { confidence: number })
        | null = null;
      let bestRawConfidence = 0;

      const scaledNails = nailDetections.map((detection) => ({
        x: detection.geometry.centerX / scaleX,
        y: detection.geometry.centerY / scaleY,
        radius:
          (Math.max(
            detection.geometry.maxWidthPx / scaleX,
            detection.geometry.maxHeightPx / scaleY
          ) *
            0.65),
      }));

      let palmBounds:
        | { minX: number; maxX: number; minY: number; maxY: number }
        | null = null;

      const landmarks = handLandmarks?.landmarksPx;
      if (landmarks?.length) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const [x, y] of landmarks) {
          minX = Math.min(minX, x / scaleX);
          maxX = Math.max(maxX, x / scaleX);
          minY = Math.min(minY, y / scaleY);
          maxY = Math.max(maxY, y / scaleY);
        }

        const palmWidth = maxX - minX;
        const palmHeight = maxY - minY;

        palmBounds = {
          minX: minX + palmWidth * 0.22,
          maxX: maxX - palmWidth * 0.22,
          minY: minY + palmHeight * 0.22,
          maxY: maxY - palmHeight * 0.22,
        };
      }

      const toOriginalCandidate = (
        x: number,
        y: number,
        r: number,
        angleRad = 0,
        perspectiveNote?: string | null
      ): ScaledCandidate => {
        // Directional scale conversion along major axis preserves exact aspect scaling
        const effScale = Math.hypot(
          Math.cos(angleRad) * scaleX,
          Math.sin(angleRad) * scaleY
        );
        const origCx = Number((x * scaleX).toFixed(2));
        const origCy = Number((y * scaleY).toFixed(2));
        const origRadius = Number((r * effScale).toFixed(2));
        return {
          center: [origCx, origCy],
          radius: origRadius,
          diameterPx: Number((origRadius * 2).toFixed(2)),
          perspectiveNote,
        };
      };

      const makeDebugEntry = (
        x: number,
        y: number,
        r: number,
        confidence: number,
        reason: string,
        status: "selected" | "rejected",
        metrics?: Partial<CalibrationCandidateDebug>
      ): CalibrationCandidateDebug => {
        const original = toOriginalCandidate(x, y, r);
        return {
          center: original.center,
          radius: original.radius,
          diameterPx: original.diameterPx,
          confidence,
          status,
          reason,
          ...metrics,
        };
      };

      const evaluatedKeys: Array<{ x: number; y: number; r: number }> = [];
      const evaluatedSeeds: Array<{ x: number; y: number; r: number }> = [];
      const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

      for (const pass of searchPasses) {
        circles.create(0, 0, cv.CV_32FC3);
        cv.HoughCircles(
          pass.mat,
          circles,
          cv.HOUGH_GRADIENT,
          pass.dp,
          35,
          pass.param1,
          pass.param2,
          minRadius,
          maxRadius
        );

        if (!circles.cols) continue;

        const raw: Array<[number, number, number]> = [];
        const rawScanLimit = Math.min(circles.cols, 120);
        for (let i = 0; i < rawScanLimit; i++) {
          // Preserve floating-point Hough proposals instead of quantizing early
          raw.push([
            circles.data32F[i * 3],
            circles.data32F[i * 3 + 1],
            circles.data32F[i * 3 + 2],
          ]);
        }

        const candidates: Array<[number, number, number]> = [];
        for (const candidate of raw) {
          if (candidates.length >= 18) break;

          const [x, y, r] = candidate;
          const duplicateInPass = candidates.some(([otherX, otherY, otherR]) => {
            const distance = Math.hypot(x - otherX, y - otherY);
            const maxCandidateRadius = Math.max(r, otherR);
            return (
              distance < maxCandidateRadius * 0.35 &&
              Math.abs(r - otherR) < maxCandidateRadius * 0.3
            );
          });
          if (duplicateInPass) continue;

          const duplicateAcrossPass = evaluatedSeeds.some(
            (s) =>
              Math.hypot(x - s.x, y - s.y) < Math.max(r, s.r) * 0.14 &&
              Math.abs(r - s.r) < Math.max(r, s.r) * 0.12
          );
          if (!duplicateAcrossPass) {
            candidates.push(candidate);
          }
        }

        for (const [houghX, houghY, houghR] of candidates) {
          evaluatedSeeds.push({ x: houghX, y: houghY, r: houghR });
          if (
            houghX - houghR * 0.5 < 5 ||
            houghY - houghR * 0.5 < 5 ||
            houghX + houghR * 0.5 >= workW - 5 ||
            houghY + houghR * 0.5 >= workH - 5 ||
            houghR < minRadius * 0.65
          ) {
            debugCandidates.push(
              makeDebugEntry(
                houghX,
                houghY,
                houghR,
                0,
                "Candidate touches image boundary or radius is below minimum",
                "rejected"
              )
            );
            continue;
          }

          const preOverlapsNail = scaledNails.some(
            (nail) =>
              Math.hypot(houghX - nail.x, houghY - nail.y) <
              houghR * 0.75 + nail.radius
          );

          if (preOverlapsNail) {
            debugCandidates.push(
              makeDebugEntry(
                houghX,
                houghY,
                houghR,
                0,
                "Candidate overlaps detected fingernail",
                "rejected"
              )
            );
            continue;
          }

          // Reject candidate if its center is located inside the central palm area (prevents knuckle false positives)
          if (palmBounds) {
            if (
              houghX >= palmBounds.minX &&
              houghX <= palmBounds.maxX &&
              houghY >= palmBounds.minY &&
              houghY <= palmBounds.maxY
            ) {
              debugCandidates.push(
                makeDebugEntry(
                  houghX,
                  houghY,
                  houghR,
                  0,
                  "Candidate is in the center of hand/palm area",
                  "rejected"
                )
              );
              continue;
            }
          }

          // Refine onto actual outer physical circumference using unblurred grayscale & gradients
          const refined = refineCoinOuterBoundary(
            workBuffers,
            houghX,
            houghY,
            houghR,
            minRadius,
            maxRadius
          );

          if (!refined) {
            debugCandidates.push(
              makeDebugEntry(
                houghX,
                houghY,
                houghR,
                0,
                "Weak or out-of-bounds outer coin boundary after radial refinement",
                "rejected"
              )
            );
            continue;
          }

          const { cx: x, cy: y, radius: r, anatomy } = refined;

          // Deduplicate after refinement so inner-seam & outer seeds converging to the same coin evaluate once
          const alreadyEvaluated = evaluatedKeys.some(
            (prev) =>
              Math.hypot(x - prev.x, y - prev.y) < Math.max(r, prev.r) * 0.15 &&
              Math.abs(r - prev.r) < Math.max(r, prev.r) * 0.08
          );
          if (alreadyEvaluated) continue;
          evaluatedKeys.push({ x, y, r });

          const overlapsNail = scaledNails.some(
            (nail) => Math.hypot(x - nail.x, y - nail.y) < r + nail.radius
          );

          if (overlapsNail) {
            debugCandidates.push(
              makeDebugEntry(
                x,
                y,
                r,
                0,
                "Candidate overlaps detected fingernail",
                "rejected"
              )
            );
            continue;
          }

          if (palmBounds) {
            if (
              x >= palmBounds.minX &&
              x <= palmBounds.maxX &&
              y >= palmBounds.minY &&
              y <= palmBounds.maxY
            ) {
              debugCandidates.push(
                makeDebugEntry(
                  x,
                  y,
                  r,
                  0,
                  "Candidate is in the center of hand/palm area",
                  "rejected"
                )
              );
              continue;
            }
          }

          // 1. Primary outer-perimeter edge support (35%)
          const sOuterEdge =
            0.60 * clamp01(refined.inlierCoverage / 0.80) +
            0.40 * clamp01(refined.sectorCoverage / 0.92);

          // 2. Geometric boundary consistency & directional alignment (25%)
          const normMad = refined.madPx / Math.max(8, r);
          const normRmse = refined.rmsePx / Math.max(8, r);
          const sRadiusTight = clamp01(1 - (normMad - 0.006) / 0.032);
          const sRmseTight = clamp01(1 - (normRmse - 0.010) / 0.042);
          const sAlign = clamp01((refined.meanInlierAlign - 0.55) / 0.35);
          const sBoundaryConsistency =
            0.45 * sRadiusTight + 0.30 * sRmseTight + 0.25 * sAlign;

          // 3. Supporting bimetallic contrast (20%)
          const sBimetal =
            clamp01(anatomy.bDiff / 16) * 0.5 +
            clamp01(anatomy.warmthDiff / 22) * 0.5;

          // 4. Supporting brass outer-ring authenticity & uniformity (12%)
          const sBrass = clamp01(
            Math.max(
              (anatomy.bOut - 128) / 20,
              (anatomy.bOut - anatomy.bSurround) / 10
            )
          );
          const sRingUniform = clamp01(1 - anatomy.ringStdB / 13);
          const sBrassRing = 0.65 * sBrass + 0.35 * sRingUniform;

          // 5. Supporting inner bimetallic seam evidence (8%)
          const sSeam = clamp01(anatomy.seamEdgeMean / 24);

          const rawConfidence =
            0.35 * sOuterEdge +
            0.25 * sBoundaryConsistency +
            0.20 * sBimetal +
            0.12 * sBrassRing +
            0.08 * sSeam;

          // Perspective distortion evaluation
          let perspectiveFactor = 1.0;
          let perspectiveCap = 1.0;
          let perspectiveNote: string | null = null;
          if (refined.isElliptical) {
            if (refined.axisRatio < 0.84) {
              perspectiveFactor = 0.45;
              perspectiveCap = 0.49;
              perspectiveNote = `severe tilt ~${Math.round(
                refined.tiltDegrees
              )}° (ratio ${refined.axisRatio.toFixed(2)})`;
            } else if (refined.axisRatio < 0.90) {
              perspectiveFactor = 0.72;
              perspectiveCap = 0.67;
              perspectiveNote = `tilted ~${Math.round(
                refined.tiltDegrees
              )}° (ratio ${refined.axisRatio.toFixed(
                2
              )}), major-axis corrected — reduced planar reliability`;
            } else {
              perspectiveFactor = clamp01(
                0.84 + ((refined.axisRatio - 0.90) / 0.065) * 0.13
              );
              perspectiveNote = `tilted ~${Math.round(
                refined.tiltDegrees
              )}° (ratio ${refined.axisRatio.toFixed(
                2
              )}), ellipse major-axis corrected`;
            }
          }

          const confidence = Math.min(perspectiveCap, rawConfidence * perspectiveFactor);

          const reasons: string[] = [];
          if (
            refined.inlierCoverage < 0.52 ||
            refined.sectorCoverage < 0.66 ||
            refined.maxMissingSectorGap > 3
          ) {
            reasons.push("Incomplete or weak outer coin boundary");
          }
          if (
            normMad > 0.038 ||
            normRmse > 0.050 ||
            refined.meanInlierGrad < 16
          ) {
            reasons.push("Inconsistent or blurry outer coin radius");
          }
          if (anatomy.isInnerSeamCandidate) {
            reasons.push("Detected inner seam inside brass ring rather than outer rim");
          }
          if (refined.isElliptical && refined.axisRatio < 0.84) {
            reasons.push(
              `Excessive perspective tilt (axis ratio ${refined.axisRatio.toFixed(
                2
              )}) prevents reliable planar calibration`
            );
          }
          if (anatomy.bDiff < 5.5 && anatomy.warmthDiff < 9.0) {
            reasons.push("Mono-metallic coin / no bimetallic contrast");
          }
          if (anatomy.bOut < 126 && anatomy.bOut <= anatomy.bSurround + 2.5) {
            reasons.push("Outer ring is not brass/gold");
          }
          if (anatomy.ringSecondMinB < 115 || anatomy.ringMinB < 105) {
            reasons.push("Outer ring not complete 360° brass");
          }
          if (anatomy.ringStdB > 14) {
            reasons.push("Outer ring irregular/non-uniform");
          }
          if (confidence < pass.minConf) {
            reasons.push("Overall confidence below threshold");
          }

          const accepted = reasons.length === 0;
          const originalCandidate = toOriginalCandidate(
            x,
            y,
            r,
            refined.ellipseAngleRad,
            perspectiveNote
          );

          debugCandidates.push({
            center: originalCandidate.center,
            radius: originalCandidate.radius,
            diameterPx: originalCandidate.diameterPx,
            confidence: Math.round(confidence * 10_000) / 10_000,
            edgeSupport: Math.round(refined.inlierCoverage * 10_000) / 10_000,
            bDiff: Math.round(anatomy.bDiff * 100) / 100,
            warmthDiff: Math.round(anatomy.warmthDiff * 100) / 100,
            outerB: Math.round(anatomy.bOut * 100) / 100,
            ringMinB: Math.round(anatomy.ringMinB * 100) / 100,
            ringStdB: Math.round(anatomy.ringStdB * 100) / 100,
            seamEdgeMean: Math.round(anatomy.seamEdgeMean * 100) / 100,
            status: accepted ? "selected" : "rejected",
            reason:
              reasons.length > 0
                ? reasons.join("; ")
                : `Verified outer boundary of ₹10 reference coin (${pass.name}${
                    perspectiveNote ? `; ${perspectiveNote}` : ""
                  })`,
          });

          if (!accepted) continue;

          if (!bestCandidate || confidence > bestCandidate.confidence) {
            bestCandidate = {
              ...originalCandidate,
              confidence: Math.round(confidence * 100) / 100,
            };
            bestRawConfidence = Math.max(bestRawConfidence, rawConfidence);
          }
        }

        if (bestCandidate && (bestCandidate.confidence >= 0.78 || bestRawConfidence >= 0.85)) {
          break;
        }
      }

      if (bestCandidate) {
        const selectedKey =
          `${bestCandidate.center[0]}:${bestCandidate.center[1]}:${bestCandidate.radius}`;

        for (const candidate of debugCandidates) {
          const candidateKey =
            `${candidate.center[0]}:${candidate.center[1]}:${candidate.radius}`;

          if (candidateKey === selectedKey) {
            candidate.status = "selected";
          } else if (candidate.status === "selected") {
            candidate.status = "rejected";
            candidate.reason = "Lower confidence than selected ₹10 coin";
          }
        }

        const pixelsPerMm = Number(
          (bestCandidate.diameterPx / this.referenceDiameterMm).toFixed(4)
        );
        const tiltSuffix = bestCandidate.perspectiveNote
          ? ` — ${bestCandidate.perspectiveNote}`
          : "";

        return {
          detected: true,
          method: "INR_10_COIN",
          referenceDiameterMm: this.referenceDiameterMm,
          detectedDiameterPx: bestCandidate.diameterPx,
          pixelsPerMm,
          center: bestCandidate.center,
          radius: bestCandidate.radius,
          confidence: bestCandidate.confidence,
          message: `Verified ₹10 coin: ${bestCandidate.diameterPx}px (${pixelsPerMm.toFixed(
            2
          )} px/mm, conf: ${(bestCandidate.confidence * 100).toFixed(0)}%${tiltSuffix})`,
          candidates: debugCandidates,
        };
      }

      const sorted = [...debugCandidates]
        .filter((candidate) => candidate.reason)
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      const bestRejected =
        sorted.find((c) => (c.confidence || 0) > 0) ||
        sorted.find((c) => c.reason && !c.reason.toLowerCase().includes("touches image boundary")) ||
        sorted[0];

      return {
        detected: false,
        method: "INR_10_COIN",
        referenceDiameterMm: this.referenceDiameterMm,
        detectedDiameterPx: 0,
        pixelsPerMm: 0,
        confidence: 0,
        message: "No valid ₹10 reference coin verified in image",
        rejectionReason:
          bestRejected?.reason || "No candidates met ₹10 coin criteria",
        candidates: debugCandidates,
      };
    } catch (error: any) {
      const message = error?.message || "Unknown processing error";
      console.error("[CoinCalibration] Processing error:", error);

      return {
        ...this.failureResult(
          `Coin detection error: ${message}`,
          `Processing failure: ${message}`
        ),
        candidates: debugCandidates,
      };
    } finally {
      for (const mat of matsToDispose) {
        try {
          if (mat && typeof mat.delete === "function") mat.delete();
        } catch {
          // Ignore errors while disposing already-released Mats.
        }
      }
    }
  }

  private failureResult(message: string, rejectionReason: string): CalibrationResult {
    return {
      detected: false,
      method: "INR_10_COIN",
      referenceDiameterMm: this.referenceDiameterMm,
      pixelsPerMm: 0,
      message,
      rejectionReason,
    };
  }
}

export const coinCalibration = new CoinCalibrationEngine();
