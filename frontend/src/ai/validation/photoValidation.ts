import type {
  NailDetection,
  CalibrationResult,
  PhotoValidationResult,
  ValidationIssue,
  PhotoValidationDiagnostics,
} from "../types";

export interface PhotoValidationInput {
  imageWidth: number;
  imageHeight: number;
  rawDetections: NailDetection[];
  measuredDetections: NailDetection[];
  calibration: CalibrationResult;
}

/**
 * Robust Client-Side Photo Quality & Safety Validation Engine
 * 
 * Strict safety rules:
 * 1. Coin Verification: Reject if coin missing, unverified, or diameter <= 0.
 * 2. Resolution / Scale: Reject if min dim < 450px or pixelsPerMm < 2.5.
 * 3. Nail Count: Accept 4 or 5 nails. Reject if < 4 or raw > 8.
 * 4. Finger Separation: Reject if adjacent center distance < 0.75 * avgWidth.
 * 5. Abnormal Geometry:
 *    - Index vs Pinky: indexWidth < 0.72 * pinkyWidth AND indexWidth < 6.8mm -> Reject
 *    - Main Finger Aspect Ratio: length / width > 2.2 on Index/Middle/Ring -> Reject
 *    - Minimum Anatomical Width: width < 6.8mm on Index/Middle/Ring -> Reject (NO inflation!)
 * 6. Longitudinal Curl: Index vs Middle displacement > 22mm -> Reject
 * 
 * Never mixes validation with detection: bad photos are flagged, not artificially enlarged.
 */
export function validatePhotoQuality(
  input: PhotoValidationInput
): PhotoValidationResult {
  const {
    imageWidth,
    imageHeight,
    rawDetections,
    measuredDetections,
    calibration,
  } = input;

  const issues: ValidationIssue[] = [];
  const minDim = Math.min(imageWidth, imageHeight);
  const isCoinValid =
    calibration.detected === true &&
    typeof calibration.detectedDiameterPx === "number" &&
    calibration.detectedDiameterPx > 0 &&
    typeof calibration.pixelsPerMm === "number" &&
    calibration.pixelsPerMm > 0 &&
    (calibration.confidence ?? 0) >= 0.70;

  // 1. Coin Verification Check (Rule 3.A)
  if (!isCoinValid) {
    issues.push({
      code: "COIN_MISSING_OR_INVALID",
      severity: "error",
      message:
        "Please upload an image with a clearly visible verified ₹10 coin on the same flat surface.",
    });
  }

  // 2. Resolution / Scale Check (Rule 3.B)
  if (minDim < 450) {
    issues.push({
      code: "RESOLUTION_TOO_LOW",
      severity: "error",
      message: `Image resolution (${imageWidth}×${imageHeight}px) is too low for accurate nail sizing. Minimum required dimension is 450px.`,
      metric: "minDimension",
      value: minDim,
      threshold: 450,
    });
  } else if (isCoinValid && calibration.pixelsPerMm && calibration.pixelsPerMm < 2.5) {
    issues.push({
      code: "RESOLUTION_TOO_LOW",
      severity: "error",
      message:
        "Image scale is too low for accurate nail sizing (less than 2.5 pixels/mm). Please take the photo closer to the hand.",
      metric: "pixelsPerMm",
      value: calibration.pixelsPerMm,
      threshold: 2.5,
    });
  }

  // 3. Nail Count Check (Rule 3.C)
  const nailCount = measuredDetections.length;
  if (nailCount < 3) {
    issues.push({
      code: "NAIL_COUNT_LOW",
      severity: "error",
      message: `Only ${nailCount} nail(s) detected. Please ensure at least 3 fingers are clearly visible with the ₹10 coin.`,
      metric: "nailCount",
      value: nailCount,
      threshold: 3,
    });
  } else if (nailCount < 5) {
    issues.push({
      code: "NAIL_COUNT_PARTIAL",
      severity: "warning",
      message: `${nailCount} nail(s) detected. For complete 5-finger recommendations, please show all 5 fingers.`,
      metric: "nailCount",
      value: nailCount,
      threshold: 5,
    });
  }

  if (rawDetections.length > 8) {
    issues.push({
      code: "NAIL_COUNT_EXCESSIVE",
      severity: "error",
      message: `Too many nail detections (${rawDetections.length} detected). Please ensure good lighting without distracting reflections or background objects.`,
      metric: "rawDetections",
      value: rawDetections.length,
      threshold: 8,
    });
  }

  // Build map of finger name to detection
  const fingerMap = new Map<string, NailDetection>();
  for (const det of measuredDetections) {
    if (det.fingerName) {
      const lower = det.fingerName.toLowerCase();
      if (lower.includes("thumb")) fingerMap.set("thumb", det);
      else if (lower.includes("index")) fingerMap.set("index", det);
      else if (lower.includes("middle")) fingerMap.set("middle", det);
      else if (lower.includes("ring")) fingerMap.set("ring", det);
      else if (lower.includes("pinky")) fingerMap.set("pinky", det);
      fingerMap.set(lower, det);
    }
  }

  // 4. Finger Separation Validation (Rule 4)
  const separationChecks: NonNullable<PhotoValidationDiagnostics["fingerSeparation"]> = [];
  const fingerSequence = ["thumb", "index", "middle", "ring", "pinky"];
  const presentFingers = fingerSequence.filter((f) => fingerMap.has(f));

  for (let i = 0; i < presentFingers.length - 1; i++) {
    const f1Name = presentFingers[i];
    const f2Name = presentFingers[i + 1];
    const det1 = fingerMap.get(f1Name)!;
    const det2 = fingerMap.get(f2Name)!;

    const dx = det1.geometry.centerX - det2.geometry.centerX;
    const dy = det1.geometry.centerY - det2.geometry.centerY;
    const dist = Math.hypot(dx, dy);

    const avgWidth =
      (det1.geometry.maxWidthPx + det2.geometry.maxWidthPx) / 2.0;
    const minAllowedDist = 0.75 * avgWidth;
    const passed = dist >= minAllowedDist;

    separationChecks.push({
      pair: `${f1Name}-${f2Name}`,
      distancePx: Math.round(dist * 10) / 10,
      avgWidthPx: Math.round(avgWidth * 10) / 10,
      ratio: Math.round((dist / (avgWidth || 1)) * 100) / 100,
      passed,
    });

    if (!passed) {
      issues.push({
        code: "FINGER_SEPARATION_TOO_CLOSE",
        severity: "error",
        message:
          "Fingers appear too close or overlapping. Please keep your fingers slightly separated so each nail is clearly visible.",
        finger: `${f1Name}/${f2Name}`,
        value: dist,
        threshold: minAllowedDist,
      });
    }
  }

  // 5. Nail Visibility / Abnormal Geometry (Rule 5)
  const indexDet = fingerMap.get("index");
  const pinkyDet = fingerMap.get("pinky");
  const middleDet = fingerMap.get("middle");
  const ringDet = fingerMap.get("ring");

  // A. Index vs Pinky Check
  if (
    indexDet &&
    pinkyDet &&
    indexDet.widthMm !== undefined &&
    pinkyDet.widthMm !== undefined
  ) {
    if (
      indexDet.widthMm < 0.72 * pinkyDet.widthMm &&
      indexDet.widthMm < 6.8
    ) {
      issues.push({
        code: "INDEX_VS_PINKY_ABNORMAL",
        severity: "error",
        message:
          "Please retake the photo with your fingers straight and nails clearly visible (ensure fingers are flat and not rolled sideways).",
        finger: "Index",
        value: indexDet.widthMm,
        threshold: 6.8,
      });
    }
  }

  // B. Main Finger Aspect Ratio (> 2.2) and Minimum Width (< 6.8mm)
  const mainFingers = [
    { name: "Index", det: indexDet },
    { name: "Middle", det: middleDet },
    { name: "Ring", det: ringDet },
  ];

  for (const { name, det } of mainFingers) {
    if (!det) continue;

    const widthPx = det.geometry.maxWidthPx;
    const heightPx = det.geometry.maxHeightPx;
    const aspectRatio = widthPx > 0 ? heightPx / widthPx : 0;

    // Aspect Ratio Check (> 2.2)
    if (aspectRatio > 2.2) {
      issues.push({
        code: "ASPECT_RATIO_EXCESSIVE",
        severity: "error",
        message:
          "Please retake the photo with your fingers straight and nails clearly visible (ensure fingers are flat and not rolled sideways).",
        finger: name,
        metric: "aspectRatio",
        value: Math.round(aspectRatio * 100) / 100,
        threshold: 2.2,
      });
    }

    // Minimum Anatomical Width Check (< 6.8mm)
    if (det.widthMm !== undefined && det.widthMm < 6.8) {
      issues.push({
        code: "WIDTH_SUSPICIOUSLY_NARROW",
        severity: "error",
        message: `Detected nail width is abnormally narrow (${det.widthMm} mm on ${name}). Please retake the photo with fingers flat and closer to the camera.`,
        finger: name,
        metric: "widthMm",
        value: det.widthMm,
        threshold: 6.8,
      });
    }
  }

  // 6. Longitudinal Curl / Retraction (Rule 6)
  let longitudinalDisplacementMm: number | undefined;
  if (indexDet && middleDet && calibration.pixelsPerMm && calibration.pixelsPerMm > 0) {
    const deltaX = indexDet.geometry.centerX - middleDet.geometry.centerX;
    const deltaY = indexDet.geometry.centerY - middleDet.geometry.centerY;

    // Use orientation-aware longitudinal displacement:
    // If transverse axis from index to pinky/ring is known, project perpendicular to it.
    let longitudinalGapPx: number;
    const refOther = pinkyDet || ringDet;
    if (refOther) {
      const tDx = refOther.geometry.centerX - indexDet.geometry.centerX;
      const tDy = refOther.geometry.centerY - indexDet.geometry.centerY;
      const tLen = Math.hypot(tDx, tDy);
      if (tLen > 0) {
        // Unit normal (longitudinal direction)
        const lx = -tDy / tLen;
        const ly = tDx / tLen;
        longitudinalGapPx = Math.abs(deltaX * lx + deltaY * ly);
      } else {
        longitudinalGapPx = Math.abs(deltaY);
      }
    } else {
      longitudinalGapPx = Math.min(Math.abs(deltaX), Math.abs(deltaY));
    }

    longitudinalDisplacementMm =
      Math.round((longitudinalGapPx / calibration.pixelsPerMm) * 10) / 10;

    if (longitudinalDisplacementMm > 22.0) {
      issues.push({
        code: "LONGITUDINAL_CURL",
        severity: "error",
        message:
          "Please retake the photo with your fingers straight and parallel on a flat surface (avoid curling fingers).",
        metric: "longitudinalDisplacementMm",
        value: longitudinalDisplacementMm,
        threshold: 22.0,
      });
    }
  }

  // Compile Comprehensive Diagnostics
  const diagnostics: PhotoValidationDiagnostics = {
    imageResolution: { width: imageWidth, height: imageHeight },
    minImageDimension: minDim,
    coinDetected: Boolean(calibration.detected),
    coinConfidence: calibration.confidence ?? 0,
    coinDiameterPx: calibration.detectedDiameterPx ?? 0,
    pixelsPerMm: calibration.pixelsPerMm ?? 0,
    nailCount: measuredDetections.length,
    fingerLabels: measuredDetections.map((d) => d.fingerName || "Unassigned"),
    nailMetrics: measuredDetections.map((d) => ({
      finger: d.fingerName || "Nail",
      widthPx: d.geometry.maxWidthPx,
      heightPx: d.geometry.maxHeightPx,
      widthMm: d.widthMm,
      heightMm: d.heightMm,
      aspectRatio: d.aspectRatio ?? (d.geometry.maxWidthPx > 0 ? d.geometry.maxHeightPx / d.geometry.maxWidthPx : 0),
      angleDeg: d.angleDeg ?? d.geometry.angleDeg,
      contourPointCount: d.geometry.contourPoints?.length,
      boundingBox: d.origBox,
      center: [d.geometry.centerX, d.geometry.centerY],
      maskPixels: d.maskPixels,
    })),
    fingerSeparation: separationChecks,
    longitudinalDisplacementMm,
  };

  const errors = issues.filter((i) => i.severity === "error");
  const passed = errors.length === 0;
  const primaryError = errors.length > 0 ? errors[0].message : undefined;

  return {
    passed,
    primaryError,
    issues,
    diagnostics,
  };
}
