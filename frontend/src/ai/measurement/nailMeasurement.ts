import { recommendNailSize } from "@/constants/nailSizes";
import type { NailDetection, CalibrationResult } from "../types";

/**
 * Orientation-Invariant Minimum-Area Rotated Millimeter Measurement
 * 
 * Strict Python Reference Formula:
 * - width_px = transverse_px = min(dim1, dim2)
 * - height_px = longitudinal_px = max(dim1, dim2)
 * - width_mm = width_px * 27.0 / coin_diameter
 * - height_mm = height_px * 27.0 / coin_diameter
 * 
 * CRITICAL CALIBRATION SAFETY RULE:
 * - Converts to mm ONLY when a verified calibration ratio is present.
 * - NEVER uses 100px default coin fallback or hardcoded scale.
 * - If coin is unverified or diameter <= 0, leaves mm as undefined and marks size as "Pending Calibration".
 */
export function measureAndSizeNails(
  detections: NailDetection[],
  calibration: CalibrationResult
): NailDetection[] {
  const isCalibrated =
    calibration.detected === true &&
    typeof calibration.pixelsPerMm === "number" &&
    calibration.pixelsPerMm > 0 &&
    typeof calibration.detectedDiameterPx === "number" &&
    calibration.detectedDiameterPx > 0;

  const coinDiameterPx = calibration.detectedDiameterPx || 0;

  return detections.map((det) => {
    const widthPx = det.geometry.maxWidthPx;
    const heightPx = det.geometry.maxHeightPx;
    const aspectRatio =
      widthPx > 0 ? Math.round((heightPx / widthPx) * 100) / 100 : 0;
    const angleDeg = det.geometry.angleDeg ?? det.angleDeg ?? 0;

    if (isCalibrated && coinDiameterPx > 0) {
      // Python reference formula:
      // width_mm = (width_px * 27.0) / coin_diameter
      // height_mm = (height_px * 27.0) / coin_diameter
      const widthMm =
        Math.round(((widthPx * 27.0) / coinDiameterPx) * 100) / 100;
      const heightMm =
        Math.round(((heightPx * 27.0) / coinDiameterPx) * 100) / 100;
      const recommendedSize = recommendNailSize(widthMm);

      return {
        ...det,
        widthMm,
        heightMm,
        recommendedSize,
        aspectRatio,
        angleDeg,
      };
    }

    // Uncalibrated: Strictly NO fallback, NO fake scale, NO size recommendation
    return {
      ...det,
      widthMm: undefined,
      heightMm: undefined,
      recommendedSize: "Pending Calibration",
      aspectRatio,
      angleDeg,
    };
  });
}
