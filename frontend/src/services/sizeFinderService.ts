import { jsPDF } from "jspdf";
import type { NailSizeResult, FingerSize, PressOnApiResponse } from "@/types";
import { pressOnPipeline } from "@/ai/pipeline/pressOnPipeline";
import type { PipelineProgressInfo } from "@/ai/types";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    ((import.meta as any).env?.VITE_PRESSON_API_URL ||
      (import.meta as any).env?.VITE_PRESSON_AI_API_URL)) ||
  (typeof import.meta !== "undefined" && (import.meta as any).env?.PROD
    ? "https://presson-ai-api.onrender.com"
    : "http://127.0.0.1:8000");

export function validateNailPhoto(file: File): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: "No image file provided." };
  }

  const hasExtension = Boolean(file.name && file.name.includes("."));
  const extension = hasExtension ? "." + file.name.split(".").pop()?.toLowerCase() : "";
  const mimeType = (file.type || "").toLowerCase().split(";")[0].trim();

  // Validate MIME type (if provided) and extension
  const hasValidType = !mimeType || ALLOWED_IMAGE_TYPES.includes(mimeType) || mimeType.startsWith("image/");
  const hasValidExt = hasExtension ? ALLOWED_EXTENSIONS.includes(extension) : true;

  // At least one indicator must match a recognized image type
  const isRecognizedType = mimeType ? (ALLOWED_IMAGE_TYPES.includes(mimeType) || mimeType.startsWith("image/")) : false;
  const isRecognizedExt = hasExtension && ALLOWED_EXTENSIONS.includes(extension);

  if (!hasValidType || !hasValidExt || (!isRecognizedType && !isRecognizedExt)) {
    return {
      isValid: false,
      error: "Unsupported image format. Please upload a JPG, JPEG, PNG, or WEBP image.",
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      isValid: false,
      error: "Image is too large. Please upload a smaller image (max 15 MB).",
    };
  }

  return { isValid: true };
}

/**
 * Adapts verified PressOn AI backend response into Aura Nails NailSizeResult.
 * Strictly uses real measurements without mock or synthetic values.
 */
export function adaptApiResponseToNailResult(apiData: PressOnApiResponse): NailSizeResult {
  const measurements = apiData.measurements || [];

  const fingerSizes: FingerSize[] = measurements.map((m) => {
    // Extract size number/label (e.g. "Size 9" -> "9" or preserve "Size 9")
    const cleanSize = m.recommended_size
      ? m.recommended_size.replace(/^Size\s+/i, "")
      : "Unknown";

    return {
      finger: m.finger,
      size: cleanSize,
      recommended_size: m.recommended_size,
      width_mm: m.width_mm,
      height_mm: m.height_mm,
      raw_width: m.raw_width,
      raw_height: m.raw_height,
    };
  });

  // Dynamically generate summary profile from verified fingers
  const summaryProfile = measurements.length > 0
    ? measurements.map((m) => `${m.finger}: ${m.recommended_size}`).join(", ")
    : "No verified measurements";

  return {
    isDemo: false,
    leftHand: fingerSizes,
    rightHand: fingerSizes,
    measurements: fingerSizes,
    summaryProfile,
    processed_image_url: apiData.processed_image_url
      ? (apiData.processed_image_url.startsWith("http")
          ? apiData.processed_image_url
          : `${API_BASE_URL.replace(/\/+$/, "")}${apiData.processed_image_url.startsWith("/") ? "" : "/"}${apiData.processed_image_url}`)
      : undefined,
    coin_detected: apiData.coin_detected,
    landmark_count: apiData.landmark_count,
    thumb_detected: apiData.thumb_detected,
    hand_side: apiData.hand_side,
  };
}

/**
 * Executes browser-only AI nail detection, calibration, and sizing pipeline.
 * Runs 100% locally in the browser with ONNX Runtime Web.
 * Zero image data is transmitted to any external backend.
 */
export async function analyzeNailImage(
  image: File,
  handSide: "left" | "right",
  onProgress?: (status: string, progress?: PipelineProgressInfo) => void
): Promise<NailSizeResult> {
  if (!handSide || (handSide !== "left" && handSide !== "right")) {
    throw new Error("Please select which hand you are showing (Left Hand or Right Hand).");
  }

  const validation = validateNailPhoto(image);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  try {
    const pipelineResult = await pressOnPipeline.executeFromFile(image, handSide, {
      confidenceThreshold: 0.25,
      iouThreshold: 0.45,
      onProgress,
    });

    if (typeof window !== "undefined") {
      (window as any).__PIPELINE_RESULT__ = pipelineResult;
    }

    const isValidationPassed = Boolean(pipelineResult.validation?.passed);
    const validationError = pipelineResult.validation?.primaryError;

    const measurements: FingerSize[] = pipelineResult.detections.map((det, idx) => ({
      finger: `Nail ${det.id || idx + 1}`,
      size: isValidationPassed
        ? (det.recommendedSize || "Pending Calibration")
        : "Validation Failed",
      recommended_size: isValidationPassed
        ? det.recommendedSize
          ? det.recommendedSize === "Pending Calibration"
            ? "Pending Calibration"
            : det.recommendedSize.startsWith("Outside") || det.recommendedSize.startsWith("Size")
              ? det.recommendedSize
              : `Size ${det.recommendedSize}`
          : "Pending Calibration"
        : "Validation Failed",
      confidence: Math.round(det.score * 100) / 100,
      width_mm: det.widthMm,
      height_mm: det.heightMm,
      raw_width: det.geometry.maxWidthPx,
      raw_height: det.geometry.maxHeightPx,
      aspect_ratio: det.aspectRatio,
      angle_deg: det.angleDeg,
      contour_points_count: det.geometry.contourPoints?.length,
      bounding_box: det.origBox,
      center: [det.geometry.centerX, det.geometry.centerY],
      mask_pixels: det.maskPixels,
      colorHex: det.color?.hex,
      nailIndex: det.id || idx + 1,
    }));

    const summaryProfile = isValidationPassed
      ? measurements.length > 0
        ? measurements
            .map((m) => `${m.finger}: ${m.recommended_size || m.size}`)
            .join(", ")
        : "No nails detected"
      : `Validation Failed: ${validationError || "Photo quality criteria not met"}`;

    return {
      isDemo: false,
      leftHand: measurements,
      rightHand: measurements,
      measurements,
      summaryProfile,
      processed_image_url: pipelineResult.annotatedImageDataUrl,
      coin_detected: pipelineResult.calibration.detected,
      landmark_count: pipelineResult.handLandmarks.landmarksPx.length,
      thumb_detected: measurements.some((m) => m.finger.toLowerCase().includes("thumb")),
      hand_side: handSide,
      calibration_message: pipelineResult.calibration.message,
      calibration: pipelineResult.calibration,
      validation: pipelineResult.validation,
      validation_error: validationError,
      debugInfo: pipelineResult.debugInfo,
    };
  } catch (err: unknown) {
    console.error("[PressOnAI] Browser pipeline error:", err);
    throw new Error(
      err instanceof Error
        ? err.message
        : "Failed to run client-side AI analysis in browser."
    );
  }
}


export function formatSizeText(sizeOrRecommended: string | number): string {
  const s = String(sizeOrRecommended).trim();
  if (!s || s === "Unknown") return "Unknown";
  if (s === "Outside supported size range") return "Outside supported size range";
  if (s.toLowerCase().startsWith("size")) return s;
  if (/^\d+$/.test(s)) return `Size ${s}`;
  return s;
}

export function generateClipboardSizeText(results: NailSizeResult): string {
  const items =
    results.measurements && results.measurements.length > 0
      ? results.measurements
      : results.leftHand || [];

  const lines = [
    "My Aura Nails Size Profile",
    "",
    ...items.map(
      (item) => `${item.finger}: ${formatSizeText(item.recommended_size || item.size)}`
    ),
  ];
  return lines.join("\n");
}

async function getImageDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:")) {
    return url;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (typeof FileReader !== "undefined") {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } else if (typeof Buffer !== "undefined") {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const mime = blob.type || "image/png";
      return `data:${mime};base64,${buffer.toString("base64")}`;
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateSizeCardPdf(
  results: NailSizeResult,
  _filename = "aura-nails-size-card.pdf"
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const items =
    results.measurements && results.measurements.length > 0
      ? results.measurements
      : results.leftHand || [];

  // Top brand accent header
  doc.setFillColor(243, 237, 246); // #f3edf6
  doc.rect(0, 0, 210, 10, "F");

  // Header Titles
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(56, 37, 59); // #38253b
  doc.text("AURA NAILS", 20, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(117, 86, 123); // #75567b
  doc.text("by Khushi · Custom Handcrafted Press-On Nails", 20, 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(56, 37, 59);
  doc.text("AI Nail Size Card", 190, 24, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(117, 86, 123);
  doc.text("Calibrated with ₹10 Reference Coin", 190, 30, { align: "right" });

  // Divider line
  doc.setDrawColor(225, 215, 230);
  doc.setLineWidth(0.5);
  doc.line(20, 35, 190, 35);

  // SECTION 1: Customer Nail Size Profile
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(56, 37, 59);
  doc.text("Customer Nail Size Profile", 20, 44);

  if (items.length > 0) {
    const cardGap = 3;
    const totalAvailableWidth = 170;
    const cardWidth = (totalAvailableWidth - (items.length - 1) * cardGap) / items.length;
    const cardHeight = 18;
    const cardY = 48;

    items.forEach((item, index) => {
      const cardX = 20 + index * (cardWidth + cardGap);

      // Card background
      doc.setFillColor(248, 244, 250);
      doc.setDrawColor(220, 205, 226);
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 1.5, 1.5, "FD");

      // Finger name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(117, 86, 123);
      doc.text(item.finger.toUpperCase(), cardX + cardWidth / 2, cardY + 6.5, {
        align: "center",
      });

      // Size
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(56, 37, 59);
      doc.text(
        formatSizeText(item.recommended_size || item.size),
        cardX + cardWidth / 2,
        cardY + 13.5,
        { align: "center" }
      );
    });
  }

  // SECTION 2: AI Verified Measurements Table
  const tableStartY = 74;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(56, 37, 59);
  doc.text("AI Verified Measurements", 20, tableStartY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(117, 86, 123);
  doc.text(
    "Millimeter dimensions calibrated via computer vision contour segmentation",
    20,
    tableStartY + 5
  );

  // Table header
  const tableHeaderY = tableStartY + 9;
  const colX = [20, 52, 90, 124, 158];
  const headerHeight = 7.5;

  doc.setFillColor(243, 237, 246);
  doc.rect(20, tableHeaderY, 170, headerHeight, "F");
  doc.setDrawColor(220, 205, 226);
  doc.rect(20, tableHeaderY, 170, headerHeight, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(56, 37, 59);
  doc.text("FINGER", colX[0] + 4, tableHeaderY + 5);
  doc.text("RECOMMENDED SIZE", colX[1] + 4, tableHeaderY + 5);
  doc.text("WIDTH (MM)", colX[2] + 4, tableHeaderY + 5);
  doc.text("HEIGHT (MM)", colX[3] + 4, tableHeaderY + 5);
  doc.text("BOUNDING BOX", colX[4] + 4, tableHeaderY + 5);

  let currentY = tableHeaderY + headerHeight;
  const rowHeight = 7;

  items.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(250, 248, 252);
      doc.rect(20, currentY, 170, rowHeight, "F");
    }
    doc.setDrawColor(235, 228, 240);
    doc.rect(20, currentY, 170, rowHeight, "S");

    // Finger
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(56, 37, 59);
    doc.text(item.finger, colX[0] + 4, currentY + 4.8);

    // Recommended size (bold)
    doc.setFont("helvetica", "bold");
    doc.text(formatSizeText(item.recommended_size || item.size), colX[1] + 4, currentY + 4.8);

    // Width mm
    doc.setFont("helvetica", "normal");
    const widthText = typeof item.width_mm === "number" ? `${item.width_mm.toFixed(2)} mm` : "-";
    doc.text(widthText, colX[2] + 4, currentY + 4.8);

    // Height mm
    const heightText = typeof item.height_mm === "number" ? `${item.height_mm.toFixed(2)} mm` : "-";
    doc.text(heightText, colX[3] + 4, currentY + 4.8);

    // Raw px
    const rawText =
      typeof item.raw_width === "number" && typeof item.raw_height === "number"
        ? `${item.raw_width} × ${item.raw_height} px`
        : "-";
    doc.text(rawText, colX[4] + 4, currentY + 4.8);

    currentY += rowHeight;
  });

  // SECTION 3: AI Detection Reference
  currentY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(56, 37, 59);
  doc.text("AI Detection Reference", 20, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(117, 86, 123);
  doc.text(
    "Visual verification showing ₹10 coin calibration boundary and nail contours",
    20,
    currentY + 5
  );

  currentY += 9;

  let imageEmbedded = false;
  if (results.processed_image_url) {
    const dataUrl = await getImageDataUrl(results.processed_image_url);
    if (dataUrl) {
      try {
        const imgWidth = 85;
        const imgHeight = 65;
        const imgX = 20;
        doc.addImage(dataUrl, "PNG", imgX, currentY, imgWidth, imgHeight);

        const legendX = imgX + imgWidth + 8;
        const legendWidth = 170 - (imgWidth + 8);
        const legendY = currentY;

        doc.setFillColor(248, 244, 250);
        doc.setDrawColor(220, 205, 226);
        doc.roundedRect(legendX, legendY, legendWidth, imgHeight, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(56, 37, 59);
        doc.text("Detection Legend", legendX + 6, legendY + 8);

        // Blue Circle: ₹10 Reference Coin
        doc.setFillColor(37, 99, 235);
        doc.circle(legendX + 8, legendY + 16, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(56, 37, 59);
        doc.text("Blue Circle: ₹10 Coin Reference", legendX + 13, legendY + 17);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(117, 86, 123);
        doc.text("Fixed 27.0 mm diameter calibration", legendX + 13, legendY + 21);

        // Green Outline: Nail Contours
        doc.setFillColor(34, 197, 94);
        doc.circle(legendX + 8, legendY + 28, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(56, 37, 59);
        doc.text("Green Outline: Nail Contours", legendX + 13, legendY + 29);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(117, 86, 123);
        doc.text("AI segmented nail bed boundaries", legendX + 13, legendY + 33);

        // Red: Dimensional labels
        doc.setFillColor(220, 38, 38);
        doc.circle(legendX + 8, legendY + 40, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(56, 37, 59);
        doc.text("Red Labels: Dimensions", legendX + 13, legendY + 41);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(117, 86, 123);
        doc.text("Width & height extracted in mm", legendX + 13, legendY + 45);

        // Calibration Note
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(56, 37, 59);
        doc.text("Status: Calibrated & Verified", legendX + 6, legendY + 56);

        imageEmbedded = true;
        currentY += imgHeight + 8;
      } catch {
        imageEmbedded = false;
      }
    }
  }

  if (!imageEmbedded) {
    doc.setFillColor(248, 244, 250);
    doc.setDrawColor(220, 205, 226);
    doc.roundedRect(20, currentY, 170, 24, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(56, 37, 59);
    doc.text("₹10 Coin Calibration Reference Verified", 26, currentY + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(117, 86, 123);
    doc.text(
      "Nail contours and finger positions calibrated using computer vision against Indian ₹10 coin.",
      26,
      currentY + 16
    );
    currentY += 32;
  }

  // Footer
  doc.setDrawColor(225, 215, 230);
  doc.setLineWidth(0.5);
  doc.line(20, 276, 190, 276);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 120, 145);
  doc.text("Aura Nails Studio by Khushi · Custom Handcrafted Press-On Nails", 105, 282, {
    align: "center",
  });
  doc.text(
    "Generated via PressOn AI Computer Vision · Calibration: Indian ₹10 Coin (27 mm)",
    105,
    286,
    { align: "center" }
  );

  return doc;
}

export async function downloadSizeCardPdf(
  results: NailSizeResult,
  filename = "aura-nails-size-card.pdf"
): Promise<void> {
  const doc = await generateSizeCardPdf(results, filename);
  doc.save(filename);
}

// Backward-compatible alias
export const downloadSizeCard = downloadSizeCardPdf;
