import type {
  CalibrationResult,
  CalibrationCandidateDebug,
  NailDetection,
  HandLandmarkData,
} from "../types";

/**
 * Physical diameter of standard Indian ₹10 coin: 27.00 mm
 * Production-ready 3-pass adaptive calibration engine (Refactored & Verified)
 */
export const REFERENCE_COIN_DIAMETER_MM = 27.0;

const MAX_PROCESSING_DIM = 1280;
const OPENCV_SCRIPT_SRC = "/opencv/opencv.js";
const OPENCV_TIMEOUT_MS = 15_000;
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

    // Rounding can make the effective X/Y scales differ slightly. Keep
    // independent coordinate factors for positions, and their mean for radii.
    const scaleX = origW / workW;
    const scaleY = origH / workH;
    const scaleRadius = (scaleX + scaleY) / 2;

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

      const equalized = registerMat(new cv.Mat());
      cv.equalizeHist(gray, equalized);

      const eqBlurred = registerMat(new cv.Mat());
      cv.GaussianBlur(
        equalized,
        eqBlurred,
        new cv.Size(9, 9),
        2,
        2,
        cv.BORDER_DEFAULT
      );

      const lab = registerMat(new cv.Mat());
      cv.cvtColor(bgr, lab, cv.COLOR_BGR2Lab);

      const sobelX = registerMat(new cv.Mat());
      const sobelY = registerMat(new cv.Mat());
      cv.Sobel(gray, sobelX, cv.CV_64F, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
      cv.Sobel(gray, sobelY, cv.CV_64F, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);

      const numPixels = workH * workW;
      const sxData = sobelX.data64F;
      const syData = sobelY.data64F;
      const gradMag = new Float32Array(numPixels);

      for (let i = 0; i < numPixels; i++) {
        const gx = sxData[i];
        const gy = syData[i];
        gradMag[i] = Math.hypot(gx, gy);
      }

      const minDim = Math.min(workH, workW);
      const minRadius = Math.max(16, Math.floor(minDim * 0.025));
      const maxRadius = Math.min(145, Math.floor(minDim * 0.18));

      const searchPasses = [
        { name: "standard", mat: blurred, param1: 100, param2: 25, minConf: 0.65 },
        { name: "contrast_boost", mat: eqBlurred, param1: 90, param2: 22, minConf: 0.62 },
        { name: "sensitive", mat: eqBlurred, param1: 85, param2: 18, minConf: 0.58 },
      ];

      const circles = registerMat(new cv.Mat());
      const maskInner = registerMat(new cv.Mat());
      const maskOuter = registerMat(new cv.Mat());
      const maskSurround = registerMat(new cv.Mat());
      const sectorMask = registerMat(new cv.Mat());

      let bestCandidate:
        | (ScaledCandidate & { confidence: number })
        | null = null;

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

      const toOriginalCandidate = (x: number, y: number, r: number): ScaledCandidate => {
        const originalRadius = Math.round(r * scaleRadius);
        return {
          center: [Math.round(x * scaleX), Math.round(y * scaleY)],
          radius: originalRadius,
          diameterPx: originalRadius * 2,
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

      for (const pass of searchPasses) {
        circles.create(0, 0, cv.CV_32FC3);
        cv.HoughCircles(
          pass.mat,
          circles,
          cv.HOUGH_GRADIENT,
          1.2,
          35,
          pass.param1,
          pass.param2,
          minRadius,
          maxRadius
        );

        if (!circles.cols) continue;

        const raw: Array<[number, number, number]> = [];
        for (let i = 0; i < circles.cols; i++) {
          raw.push([
            Math.round(circles.data32F[i * 3]),
            Math.round(circles.data32F[i * 3 + 1]),
            Math.round(circles.data32F[i * 3 + 2]),
          ]);
        }

        const candidates: Array<[number, number, number]> = [];
        for (const candidate of raw) {
          if (candidates.length >= 45) break;

          const [x, y, r] = candidate;
          const duplicate = candidates.some(([otherX, otherY, otherR]) => {
            const distance = Math.hypot(x - otherX, y - otherY);
            const maxCandidateRadius = Math.max(r, otherR);
            return (
              distance < maxCandidateRadius * 0.35 &&
              Math.abs(r - otherR) < maxCandidateRadius * 0.3
            );
          });

          if (!duplicate) candidates.push(candidate);
        }

        for (const [x, y, r] of candidates) {
          if (
            x - r < 5 ||
            y - r < 5 ||
            x + r >= workW - 5 ||
            y + r >= workH - 5 ||
            r < minRadius
          ) {
            debugCandidates.push(
              makeDebugEntry(
                x,
                y,
                r,
                0,
                "Candidate touches image boundary or radius is below minimum",
                "rejected"
              )
            );
            continue;
          }

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

          // Reject candidate if its center is located inside the central palm area (prevents knuckle false positives)
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

          let edgeHits = 0;
          for (let i = 0; i < 36; i++) {
            const theta = (2 * Math.PI * i) / 36;
            const px = Math.max(
              0,
              Math.min(workW - 1, Math.floor(x + r * Math.cos(theta)))
            );
            const py = Math.max(
              0,
              Math.min(workH - 1, Math.floor(y + r * Math.sin(theta)))
            );

            if (gradMag[py * workW + px] > 20) edgeHits++;
          }
          const edgeSupport = edgeHits / 36;

          maskInner.create(workH, workW, cv.CV_8UC1);
          maskInner.setTo(new cv.Scalar(0));
          cv.circle(
            maskInner,
            new cv.Point(x, y),
            Math.floor(0.52 * r),
            new cv.Scalar(255),
            -1
          );

          maskOuter.create(workH, workW, cv.CV_8UC1);
          maskOuter.setTo(new cv.Scalar(0));
          cv.circle(
            maskOuter,
            new cv.Point(x, y),
            Math.floor(0.95 * r),
            new cv.Scalar(255),
            -1
          );
          cv.circle(
            maskOuter,
            new cv.Point(x, y),
            Math.floor(0.70 * r),
            new cv.Scalar(0),
            -1
          );

          maskSurround.create(workH, workW, cv.CV_8UC1);
          maskSurround.setTo(new cv.Scalar(0));
          cv.circle(
            maskSurround,
            new cv.Point(x, y),
            Math.floor(1.3 * r),
            new cv.Scalar(255),
            -1
          );
          cv.circle(
            maskSurround,
            new cv.Point(x, y),
            Math.floor(1.1 * r),
            new cv.Scalar(0),
            -1
          );

          const meanBgrIn = cv.mean(bgr, maskInner);
          const meanBgrOut = cv.mean(bgr, maskOuter);
          const meanLabIn = cv.mean(lab, maskInner);
          const meanLabOut = cv.mean(lab, maskOuter);
          const meanLabSurround = cv.mean(lab, maskSurround);

          const bIn = meanLabIn[2];
          const bOut = meanLabOut[2];
          const bSurround = meanLabSurround[2];
          const bDiff = bOut - bIn;

          const warmthIn = (meanBgrIn[2] + meanBgrIn[1]) / 2 - meanBgrIn[0];
          const warmthOut = (meanBgrOut[2] + meanBgrOut[1]) / 2 - meanBgrOut[0];
          const warmthDiff = warmthOut - warmthIn;

          const sectorBValues: number[] = [];
          for (let sector = 0; sector < 8; sector++) {
            sectorMask.create(workH, workW, cv.CV_8UC1);
            sectorMask.setTo(new cv.Scalar(0));
            cv.ellipse(
              sectorMask,
              new cv.Point(x, y),
              new cv.Size(Math.floor(0.95 * r), Math.floor(0.95 * r)),
              0,
              (360 * sector) / 8,
              (360 * (sector + 1)) / 8,
              new cv.Scalar(255),
              -1
            );
            cv.circle(
              sectorMask,
              new cv.Point(x, y),
              Math.floor(0.70 * r),
              new cv.Scalar(0),
              -1
            );
            sectorBValues.push(cv.mean(lab, sectorMask)[2]);
          }

          const ringMinB = Math.min(...sectorBValues);
          const meanSectorB =
            sectorBValues.reduce((sum, value) => sum + value, 0) /
            sectorBValues.length;
          const ringVariance =
            sectorBValues.reduce(
              (sum, value) => sum + (value - meanSectorB) ** 2,
              0
            ) / sectorBValues.length;
          const ringStdB = Math.sqrt(ringVariance);

          let seamSum = 0;
          for (let i = 0; i < 36; i++) {
            const theta = (2 * Math.PI * i) / 36;
            const px = Math.max(
              0,
              Math.min(
                workW - 1,
                Math.floor(x + 0.68 * r * Math.cos(theta))
              )
            );
            const py = Math.max(
              0,
              Math.min(
                workH - 1,
                Math.floor(y + 0.68 * r * Math.sin(theta))
              )
            );
            seamSum += gradMag[py * workW + px];
          }
          const seamEdgeMean = seamSum / 36;

          const sBimetal =
            Math.min(1, Math.max(0, bDiff / 18)) * 0.5 +
            Math.min(1, Math.max(0, warmthDiff / 25)) * 0.5;
          const sBrass = Math.min(
            1,
            Math.max(
              0,
              Math.max((bOut - 128) / 20, (bOut - bSurround) / 10)
            )
          );
          const sRingUniform = Math.min(1, Math.max(0, 1 - ringStdB / 12));
          const sCircle = Math.min(1, edgeSupport / 0.45);
          const sSeam = Math.min(1, seamEdgeMean / 28);

          const confidence =
            0.35 * sBimetal +
            0.25 * sBrass +
            0.15 * sRingUniform +
            0.15 * sCircle +
            0.1 * sSeam;

          const reasons: string[] = [];
          if (edgeSupport < 0.28) reasons.push("Weak perimeter circular edge");
          if (bDiff < 6 && warmthDiff < 10) {
            reasons.push("Mono-metallic coin / no bimetallic contrast");
          }
          if (bOut < 128 && bOut <= bSurround + 3) {
            reasons.push("Outer ring is not brass/gold");
          }
          if (ringMinB < 118) {
            reasons.push("Outer ring not complete 360° brass");
          }
          if (ringStdB > 12) {
            reasons.push("Outer ring irregular/non-uniform");
          }
          if (confidence < pass.minConf) {
            reasons.push("Overall confidence below threshold");
          }

          const accepted = reasons.length === 0;
          const originalCandidate = toOriginalCandidate(x, y, r);

          debugCandidates.push({
            center: originalCandidate.center,
            radius: originalCandidate.radius,
            diameterPx: originalCandidate.diameterPx,
            confidence: Math.round(confidence * 10_000) / 10_000,
            edgeSupport: Math.round(edgeSupport * 10_000) / 10_000,
            bDiff: Math.round(bDiff * 100) / 100,
            warmthDiff: Math.round(warmthDiff * 100) / 100,
            outerB: Math.round(bOut * 100) / 100,
            ringMinB: Math.round(ringMinB * 100) / 100,
            ringStdB: Math.round(ringStdB * 100) / 100,
            seamEdgeMean: Math.round(seamEdgeMean * 100) / 100,
            status: accepted ? "selected" : "rejected",
            reason:
              reasons.length > 0
                ? reasons.join("; ")
                : `Verified ₹10 bimetallic reference coin (${pass.name})`,
          });

          if (!accepted) continue;

          if (!bestCandidate || confidence > bestCandidate.confidence) {
            bestCandidate = {
              ...originalCandidate,
              confidence: Math.round(confidence * 100) / 100,
            };
          }
        }

        if (bestCandidate && bestCandidate.confidence >= 0.7) break;
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
          )} px/mm, conf: ${(bestCandidate.confidence * 100).toFixed(0)}%)`,
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
