import * as ort from "onnxruntime-web/wasm";
import type { LetterboxMeta } from "../types";

/**
 * Preprocess an image using YOLO letterboxing (preserving aspect ratio)
 * Converts image to Float32 Tensor [1, 3, targetH, targetW] normalized to [0, 1].
 */
export function preprocessImage(
  img: HTMLImageElement | HTMLCanvasElement,
  targetW = 416,
  targetH = 416
): { tensor: ort.Tensor; meta: LetterboxMeta } {
  const origW = (img instanceof HTMLImageElement ? img.naturalWidth : img.width) || img.width;
  const origH = (img instanceof HTMLImageElement ? img.naturalHeight : img.height) || img.height;

  if (origW <= 0 || origH <= 0) {
    throw new Error(`Invalid image dimensions: ${origW}x${origH}`);
  }

  // Compute letterbox scale and padding
  const ratio = Math.min(targetW / origW, targetH / origH);
  const newW = Math.round(origW * ratio);
  const newH = Math.round(origH * ratio);
  const padX = (targetW - newW) / 2;
  const padY = (targetH - newH) / 2;

  // Draw image onto letterbox canvas with gray (114, 114, 114) border
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Unable to create 2D canvas context for preprocessing");
  }

  // Fill background with YOLO standard padding color (114, 114, 114)
  ctx.fillStyle = "rgb(114, 114, 114)";
  ctx.fillRect(0, 0, targetW, targetH);

  // Draw scaled image centered
  ctx.drawImage(
    img,
    0,
    0,
    origW,
    origH,
    Math.round(padX),
    Math.round(padY),
    newW,
    newH
  );

  const imgData = ctx.getImageData(0, 0, targetW, targetH).data;

  // Convert RGBA HWC to RGB NCHW float32 [1, 3, targetH, targetW]
  const planeSize = targetW * targetH;
  const float32Array = new Float32Array(3 * planeSize);

  for (let i = 0; i < planeSize; i++) {
    const r = imgData[i * 4] / 255.0;
    const g = imgData[i * 4 + 1] / 255.0;
    const b = imgData[i * 4 + 2] / 255.0;

    float32Array[i] = r;                 // Channel 0 (R)
    float32Array[planeSize + i] = g;     // Channel 1 (G)
    float32Array[2 * planeSize + i] = b; // Channel 2 (B)
  }

  const tensor = new ort.Tensor("float32", float32Array, [1, 3, targetH, targetW]);

  const meta: LetterboxMeta = {
    origW,
    origH,
    targetW,
    targetH,
    ratio,
    padX,
    padY,
    newW,
    newH,
  };

  return { tensor, meta };
}
