import * as ort from "onnxruntime-web/wasm";
import type {
  LetterboxMeta,
  RawBoxCandidate,
  NailDetection,
  MaskGeometry,
} from "../types";
import { computeMinAreaRect } from "../measurement/minAreaRect";

export const COLOR_PALETTE = [
  { rgb: "236, 72, 153", hex: "#ec4899" }, // Pink
  { rgb: "59, 130, 246", hex: "#3b82f6" },  // Blue
  { rgb: "16, 185, 129", hex: "#10b981" }, // Emerald
  { rgb: "245, 158, 11", hex: "#f59e0b" }, // Amber
  { rgb: "139, 92, 246", hex: "#8b5cf6" }, // Violet
  { rgb: "6, 182, 212", hex: "#06b6d4" },  // Cyan
  { rgb: "244, 63, 94", hex: "#f43f5e" },  // Rose
  { rgb: "34, 197, 94", hex: "#22c55e" },  // Green
  { rgb: "249, 115, 22", hex: "#f97316" }, // Orange
  { rgb: "168, 85, 247", hex: "#a855f7" }, // Purple
];

/**
 * Compute Intersection over Union (IoU) between two bounding boxes [x1, y1, x2, y2]
 */
export function computeIoU(
  b1: { x1: number; y1: number; x2: number; y2: number },
  b2: { x1: number; y1: number; x2: number; y2: number }
): number {
  const xx1 = Math.max(b1.x1, b2.x1);
  const yy1 = Math.max(b1.y1, b2.y1);
  const xx2 = Math.min(b1.x2, b2.x2);
  const yy2 = Math.min(b1.y2, b2.y2);

  const interW = Math.max(0, xx2 - xx1);
  const interH = Math.max(0, yy2 - yy1);
  const interArea = interW * interH;

  const area1 = (b1.x2 - b1.x1) * (b1.y2 - b1.y1);
  const area2 = (b2.x2 - b2.x1) * (b2.y2 - b2.y1);

  const unionArea = area1 + area2 - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

/**
 * Parse YOLOv8 segmentation model outputs, apply confidence thresholding and NMS,
 * decode prototype masks, and recover original image coordinates.
 */
export function parseYoloSegmentationOutput(
  rawOutputs: Record<string, ort.Tensor>,
  outputNames: readonly string[] | string[],
  meta: LetterboxMeta,
  confThresh = 0.25,
  iouThresh = 0.45
): NailDetection[] {
  const out0Name = outputNames[0];
  const out1Name = outputNames.length > 1 ? outputNames[1] : null;

  const tensor0 = rawOutputs[out0Name];
  const tensor1 = out1Name ? rawOutputs[out1Name] : null;

  if (!tensor0 || !tensor0.data) {
    throw new Error(`Output tensor "${out0Name}" is missing or empty`);
  }

  const out0Data = tensor0.data as Float32Array;
  const dims0 = tensor0.dims; // expected [1, 37, 3549] or similar
  const numRows = dims0[1];
  const numAnchors = dims0[2];

  const hasSegmentation = numRows > 5 && tensor1 != null;
  const numMaskWeights = hasSegmentation ? numRows - 5 : 0;

  // 1. Extract candidates above confidence threshold
  const candidates: RawBoxCandidate[] = [];

  for (let i = 0; i < numAnchors; i++) {
    const score = out0Data[4 * numAnchors + i]; // class 0 "nail" confidence
    if (score >= confThresh) {
      const cx = out0Data[0 * numAnchors + i];
      const cy = out0Data[1 * numAnchors + i];
      const w = out0Data[2 * numAnchors + i];
      const h = out0Data[3 * numAnchors + i];

      const x1 = cx - w / 2;
      const y1 = cy - h / 2;
      const x2 = cx + w / 2;
      const y2 = cy + h / 2;

      let maskCoeffs: Float32Array | null = null;
      if (hasSegmentation) {
        maskCoeffs = new Float32Array(numMaskWeights);
        for (let k = 0; k < numMaskWeights; k++) {
          maskCoeffs[k] = out0Data[(5 + k) * numAnchors + i];
        }
      }

      candidates.push({
        score,
        x1,
        y1,
        x2,
        y2,
        w,
        h,
        maskCoeffs,
      });
    }
  }

  // 2. Sort descending by confidence score
  candidates.sort((a, b) => b.score - a.score);

  // 3. Non-Maximum Suppression (NMS)
  const selected: RawBoxCandidate[] = [];
  for (const cand of candidates) {
    let keep = true;
    for (const sel of selected) {
      if (computeIoU(cand, sel) > iouThresh) {
        keep = false;
        break;
      }
    }
    if (keep) {
      selected.push(cand);
    }
  }

  // 4. Map coordinates back to original image space and decode masks
  const maskData = tensor1 ? (tensor1.data as Float32Array) : null;
  const maskDims = tensor1 ? tensor1.dims : [1, 32, 104, 104];
  const maskDim = maskDims[1] || 32;
  const maskH = maskDims[2] || 104;
  const maskW = maskDims[3] || 104;
  const maskArea = maskH * maskW;

  const detections: NailDetection[] = [];

  selected.forEach((s, idx) => {
    // Inverse letterbox mapping to original image coordinates
    const origX1 = Math.max(0, Math.min(meta.origW, (s.x1 - meta.padX) / meta.ratio));
    const origY1 = Math.max(0, Math.min(meta.origH, (s.y1 - meta.padY) / meta.ratio));
    const origX2 = Math.max(0, Math.min(meta.origW, (s.x2 - meta.padX) / meta.ratio));
    const origY2 = Math.max(0, Math.min(meta.origH, (s.y2 - meta.padY) / meta.ratio));

    const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
    const [cr, cg, cb] = color.rgb.split(",").map((v) => parseInt(v.trim()));

    let maskCanvas: HTMLCanvasElement | null = null;
    let activePixelCount = 0;
    const contourPoints: Array<[number, number]> = [];
    let rotatedCorners: Array<[number, number]> = [];

    const origW_box = Math.max(2, Math.round(origX2 - origX1));
    const origH_box = Math.max(2, Math.round(origY2 - origY1));

    if (s.maskCoeffs && maskData) {
      // Prototype mask bounding box (104 / 416)
      const scaleMask = maskW / meta.targetW;
      const mx1 = Math.max(0, Math.floor(s.x1 * scaleMask));
      const my1 = Math.max(0, Math.floor(s.y1 * scaleMask));
      const mx2 = Math.min(maskW, Math.ceil(s.x2 * scaleMask));
      const my2 = Math.min(maskH, Math.ceil(s.y2 * scaleMask));

      maskCanvas = document.createElement("canvas");
      maskCanvas.width = maskW;
      maskCanvas.height = maskH;
      const mCtx = maskCanvas.getContext("2d", { willReadFrequently: true });

      if (mCtx) {
        const mImgData = mCtx.createImageData(maskW, maskH);
        const mPixels = mImgData.data;

        for (let r = my1; r < my2; r++) {
          for (let c = mx1; c < mx2; c++) {
            let sum = 0;
            const pixelIdx = r * maskW + c;
            for (let k = 0; k < maskDim; k++) {
              sum += s.maskCoeffs[k] * maskData[k * maskArea + pixelIdx];
            }

            // Continuous sigmoid probability for smooth bilinear upscaling
            const prob = 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, sum))));
            const alpha = Math.round(prob * 255);

            if (alpha > 20) {
              const pOffset = pixelIdx * 4;
              mPixels[pOffset] = cr;
              mPixels[pOffset + 1] = cg;
              mPixels[pOffset + 2] = cb;
              mPixels[pOffset + 3] = alpha;
            }
          }
        }

        mCtx.putImageData(mImgData, 0, 0);

        // High-resolution bilinear upscaling onto the bounding box in original image space
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = origW_box;
        cropCanvas.height = origH_box;
        const cCtx = cropCanvas.getContext("2d", { willReadFrequently: true });

        if (cCtx) {
          cCtx.imageSmoothingEnabled = true;
          cCtx.imageSmoothingQuality = "high";

          const sx = s.x1 * scaleMask;
          const sy = s.y1 * scaleMask;
          const sw = Math.max(1, (s.x2 - s.x1) * scaleMask);
          const sh = Math.max(1, (s.y2 - s.y1) * scaleMask);

          cCtx.drawImage(maskCanvas, sx, sy, sw, sh, 0, 0, origW_box, origH_box);
          const cData = cCtx.getImageData(0, 0, origW_box, origH_box).data;

          // Extract smooth boundary contour points directly in original image coordinates
          // Horizontal scan (left & right perimeter per row)
          for (let y = 0; y < origH_box; y++) {
            let minX = -1;
            let maxX = -1;
            for (let x = 0; x < origW_box; x++) {
              const alpha = cData[(y * origW_box + x) * 4 + 3];
              if (alpha >= 120) {
                activePixelCount++;
                if (minX === -1) minX = x;
                maxX = x;
              }
            }
            if (minX !== -1) {
              contourPoints.push([Math.round(origX1 + minX), Math.round(origY1 + y)]);
              contourPoints.push([Math.round(origX1 + maxX), Math.round(origY1 + y)]);
            }
          }

          // Vertical scan (top & bottom perimeter per column)
          for (let x = 0; x < origW_box; x++) {
            let minY = -1;
            let maxY = -1;
            for (let y = 0; y < origH_box; y++) {
              const alpha = cData[(y * origW_box + x) * 4 + 3];
              if (alpha >= 120) {
                if (minY === -1) minY = y;
                maxY = y;
              }
            }
            if (minY !== -1) {
              contourPoints.push([Math.round(origX1 + x), Math.round(origY1 + minY)]);
              contourPoints.push([Math.round(origX1 + x), Math.round(origY1 + maxY)]);
            }
          }
        }
      }
    }

    const boxW = Math.max(1, origX2 - origX1);
    const boxH = Math.max(1, origY2 - origY1);

    // Orientation-invariant minimum-area rotated rectangle (Python minAreaRect reference):
    // min(dim1, dim2) = transverse_px = nail width
    // max(dim1, dim2) = longitudinal_px = nail length
    let widthPx: number;
    let heightPx: number;
    let angleDeg = 0;
    let finalCenterX = (origX1 + origX2) / 2;
    let finalCenterY = (origY1 + origY2) / 2;

    if (contourPoints.length >= 3) {
      const rotatedRect = computeMinAreaRect(contourPoints);
      widthPx = rotatedRect.width;
      heightPx = rotatedRect.height;
      angleDeg = rotatedRect.angle;
      finalCenterX = rotatedRect.center[0];
      finalCenterY = rotatedRect.center[1];
      if (rotatedRect.corners && rotatedRect.corners.length === 4) {
        rotatedCorners = rotatedRect.corners;
      }
    } else {
      // Fallback if mask points are insufficient:
      widthPx = Math.min(boxW, boxH);
      heightPx = Math.max(boxW, boxH);
      rotatedCorners = [
        [origX1, origY1],
        [origX2, origY1],
        [origX2, origY2],
        [origX1, origY2],
      ];
    }

    const aspectRatio = widthPx > 0 ? Math.round((heightPx / widthPx) * 100) / 100 : 0;

    const geometry: MaskGeometry = {
      maxWidthPx: Math.round(widthPx * 10) / 10,
      maxHeightPx: Math.round(heightPx * 10) / 10,
      centerX: Math.round(finalCenterX * 10) / 10,
      centerY: Math.round(finalCenterY * 10) / 10,
      areaPx: activePixelCount > 0 ? activePixelCount : Math.round(boxW * boxH),
      measureRow: Math.round(finalCenterY),
      contourPoints,
      angleDeg,
      aspectRatio,
      rotatedCorners,
    };

    detections.push({
      id: idx + 1,
      className: "nail",
      classId: 0,
      score: s.score,
      origBox: [
        Math.round(origX1),
        Math.round(origY1),
        Math.round(origX2),
        Math.round(origY2),
      ],
      letterboxBox: [
        Math.round(s.x1),
        Math.round(s.y1),
        Math.round(s.x2),
        Math.round(s.y2),
      ],
      color,
      maskPixels: activePixelCount,
      maskCanvas,
      geometry,
      angleDeg,
      aspectRatio,
      rotatedCorners,
    });
  });

  return detections;
}

/**
 * Render image with segmentation masks, bounding boxes, and label badges onto a Canvas
 */
export function renderDetectionsToCanvas(
  img: HTMLImageElement | HTMLCanvasElement,
  detections: NailDetection[],
  meta: LetterboxMeta,
  options: {
    showMasks?: boolean;
    showBoxes?: boolean;
    showLabels?: boolean;
    maskOpacity?: number;
    referenceCoin?: {
      center: [number, number];
      radius: number;
      pixelsPerMm: number;
    } | null;
  } = {}
): HTMLCanvasElement {
  const {
    showMasks = true,
    showBoxes = true,
    showLabels = true,
    maskOpacity = 0.45,
    referenceCoin = null,
  } = options;

  const canvas = document.createElement("canvas");
  canvas.width = meta.origW;
  canvas.height = meta.origH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // 1. Draw base hand image
  ctx.drawImage(img, 0, 0, meta.origW, meta.origH);

  // Adaptive line widths and fonts
  const diag = Math.sqrt(meta.origW * meta.origW + meta.origH * meta.origH);
  const strokeWidth = Math.max(2, Math.round(diag * 0.003));
  const fontSize = Math.max(12, Math.round(diag * 0.018));
  const badgePadX = Math.round(fontSize * 0.45);
  const badgePadY = Math.round(fontSize * 0.25);

  // 2. Render Segmentation Masks
  if (showMasks) {
    ctx.save();
    ctx.globalAlpha = maskOpacity;
    const mappedX = -meta.padX / meta.ratio;
    const mappedY = -meta.padY / meta.ratio;
    const mappedW = meta.targetW / meta.ratio;
    const mappedH = meta.targetH / meta.ratio;

    detections.forEach((det) => {
      if (det.maskCanvas && det.maskPixels > 0) {
        ctx.drawImage(det.maskCanvas, mappedX, mappedY, mappedW, mappedH);
      }
    });
    ctx.restore();
  }

  // 3. Render Reference Coin (if detected)
  if (referenceCoin) {
    const [cx, cy] = referenceCoin.center;
    const r = referenceCoin.radius;
    const coinDiameterPx = (r * 2).toFixed(1);

    ctx.save();
    ctx.strokeStyle = "#2563eb"; // Blue circle
    ctx.lineWidth = Math.max(3, strokeWidth * 1.2);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();

    // Center point marker
    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Inner marker
    ctx.fillStyle = "rgba(37, 99, 235, 0.15)";
    ctx.fill();

    // Coin label: Actual detected coin diameter in pixels & reference diameter clearly distinguished
    const coinLine1 = `Coin diameter: ${coinDiameterPx} px`;
    const coinLine2 = `Reference: 27 mm (${referenceCoin.pixelsPerMm.toFixed(2)} px/mm)`;
    ctx.font = `600 ${fontSize}px sans-serif`;
    const w1 = ctx.measureText(coinLine1).width;
    ctx.font = `500 ${Math.max(10, Math.round(fontSize * 0.85))}px sans-serif`;
    const w2 = ctx.measureText(coinLine2).width;
    const labelW = Math.max(w1, w2) + badgePadX * 2;
    const labelH = fontSize + Math.max(10, Math.round(fontSize * 0.85)) + badgePadY * 3;

    ctx.fillStyle = "#2563eb";
    const badgeX = cx - labelW / 2;
    const badgeY = cy - r - labelH - 6;
    if (ctx.roundRect) {
      ctx.roundRect(badgeX, badgeY, labelW, labelH, 6);
    } else {
      ctx.fillRect(badgeX, badgeY, labelW, labelH);
    }
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillText(coinLine1, badgeX + badgePadX, badgeY + badgePadY);
    ctx.font = `500 ${Math.max(10, Math.round(fontSize * 0.85))}px sans-serif`;
    ctx.fillText(coinLine2, badgeX + badgePadX, badgeY + badgePadY + fontSize + 2);
    ctx.restore();
  }

  // 4. Render Bounding Boxes / Rotated Rectangles / Polygons & Labels
  detections.forEach((det) => {
    const [x1, y1, x2, y2] = det.origBox;
    const boxW = x2 - x1;
    const boxH = y2 - y1;

    // Draw detected nail polygon / rotated rectangle in original image coordinates
    if (det.geometry.rotatedCorners && det.geometry.rotatedCorners.length === 4) {
      ctx.save();
      ctx.strokeStyle = det.color.hex;
      ctx.lineWidth = Math.max(2, strokeWidth);
      ctx.beginPath();
      const [c0, c1, c2, c3] = det.geometry.rotatedCorners;
      ctx.moveTo(c0[0], c0[1]);
      ctx.lineTo(c1[0], c1[1]);
      ctx.lineTo(c2[0], c2[1]);
      ctx.lineTo(c3[0], c3[1]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    } else if (showBoxes) {
      ctx.save();
      ctx.strokeStyle = det.color.hex;
      ctx.lineWidth = strokeWidth;
      ctx.strokeRect(x1, y1, boxW, boxH);
      ctx.restore();
    }

    if (showLabels) {
      ctx.save();
      const nailNum = det.id || 1;
      const nailTitle = `Nail ${nailNum}`;
      const mmText = det.widthMm ? `${det.widthMm.toFixed(2)} mm` : `${det.geometry.maxWidthPx.toFixed(1)} px`;
      const labelText = `${nailTitle}: ${mmText}`;

      ctx.font = `600 ${fontSize}px sans-serif`;
      const textMetrics = ctx.measureText(labelText);
      const textW = textMetrics.width;
      const textH = fontSize;

      const badgeW = textW + badgePadX * 2;
      const badgeH = textH + badgePadY * 2;

      let badgeX = x1;
      let badgeY = y1 - badgeH - 4;
      if (badgeY < 0) {
        badgeY = y1 + 4;
      }

      ctx.fillStyle = det.color.hex;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "top";
      ctx.fillText(labelText, badgeX + badgePadX, badgeY + badgePadY);
      ctx.restore();
    }
  });

  return canvas;
}
