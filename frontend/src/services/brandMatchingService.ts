import type { FingerSize, NailSizeResult } from "@/types";
import type { Brand, FingerWidthMap, NailWidthRange } from "@/types/brand";

export interface FingerBrandFit {
  finger: string;
  fingerKey: keyof FingerWidthMap | null;
  colorHex?: string;
  measuredWidthMm?: number;
  recommendedSize: string; // e.g. "XS", "S", "M", "L", or "0", "1", "2"
  displayRecommendation?: string; // e.g. "Nail 1 → Size S"
  chartWidthMm?: number;
  chartRange?: NailWidthRange;
  differenceMm?: number; // chartWidthMm - measuredWidthMm
  fitStatus: "exact" | "recommended" | "no_match" | "uncalibrated" | "withheld";
  explanation: string;
}

export interface BrandMatchResult {
  brand: Brand;
  fingerFits: FingerBrandFit[];
  overallSetSize: string; // e.g. "Standard Size S" or "Custom Mixed Set (XS/S)"
  isUniformSet: boolean;
  ruleExplanation: string;
  matchTimestamp: string;
}

export function resolveFingerKey(name: string): keyof FingerWidthMap | null {
  const lower = name.toLowerCase();
  if (lower.includes("thumb")) return "thumb";
  if (lower.includes("index") || lower.includes("pointer")) return "index";
  if (lower.includes("middle") || lower.includes("mid")) return "middle";
  if (lower.includes("ring")) return "ring";
  if (lower.includes("pinky") || lower.includes("little")) return "pinky";

  // Fallback for "Nail 1" ... "Nail 5"
  const match = lower.match(/nail\s*(\d)/);
  if (match) {
    const num = parseInt(match[1], 10);
    const order: Array<keyof FingerWidthMap> = ["thumb", "index", "middle", "ring", "pinky"];
    if (num >= 1 && num <= 5) return order[num - 1];
  }

  return null;
}

/**
 * Format B isolated matcher: Match a calibrated width against manufacturer millimeter ranges.
 */
export function matchWidthToRange(
  widthMm: number,
  ranges: NailWidthRange[]
): {
  sizeLabel: string;
  fitStatus: "exact" | "recommended" | "no_match";
  explanation: string;
  chartRange?: NailWidthRange;
} {
  if (!ranges || ranges.length === 0) {
    return {
      sizeLabel: "No chart ranges",
      fitStatus: "no_match",
      explanation: "Brand chart has not defined range specifications.",
    };
  }

  // Find all ranges where widthMm falls into [minMm, maxMm]
  const matched = ranges.filter((r) => widthMm >= r.minMm && widthMm <= r.maxMm);

  if (matched.length === 1) {
    const r = matched[0];
    const isExact = Math.abs(widthMm - (r.minMm + r.maxMm) / 2) <= 0.3;
    return {
      sizeLabel: r.sizeLabel,
      fitStatus: isExact ? "exact" : "recommended",
      explanation: `Measured width (${widthMm.toFixed(2)} mm) fits range ${r.minMm}–${r.maxMm} mm (Size ${r.sizeLabel}).`,
      chartRange: r,
    };
  }

  if (matched.length > 1) {
    return {
      sizeLabel: "Check chart",
      fitStatus: "no_match",
      explanation: `Measured width (${widthMm.toFixed(2)} mm) falls into overlapping ranges (${matched.map((m) => m.sizeLabel).join(", ")}). Please check chart details.`,
    };
  }

  // Check if smaller than lowest range
  const sorted = ranges.slice().sort((a, b) => a.minMm - b.minMm);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];

  if (widthMm < lowest.minMm) {
    return {
      sizeLabel: "No matching size",
      fitStatus: "no_match",
      explanation: `Measured width (${widthMm.toFixed(2)} mm) is below the minimum chart range (${lowest.minMm} mm).`,
    };
  }

  if (widthMm > highest.maxMm) {
    return {
      sizeLabel: "No matching size",
      fitStatus: "no_match",
      explanation: `Measured width (${widthMm.toFixed(2)} mm) exceeds maximum chart range (${highest.maxMm} mm).`,
    };
  }

  return {
    sizeLabel: "Check chart",
    fitStatus: "no_match",
    explanation: `Measured width (${widthMm.toFixed(2)} mm) falls into a gap between chart ranges.`,
  };
}

/**
 * Match an individual measured finger to a brand's sizing chart.
 * Supports both Format A (Per-size finger matrix) and Format B (Width ranges).
 */
export function matchFingerToBrand(
  fingerItem: FingerSize,
  brand: Brand,
  isValidationPassed = true,
  isCoinDetected = true
): FingerBrandFit {
  const fingerKey = resolveFingerKey(fingerItem.finger);

  // Check validation withhold
  if (!isValidationPassed) {
    return {
      finger: fingerItem.finger,
      fingerKey,
      colorHex: fingerItem.colorHex,
      measuredWidthMm: fingerItem.width_mm,
      recommendedSize: "Validation Withheld",
      displayRecommendation: `${fingerItem.finger} → Withheld`,
      fitStatus: "withheld",
      explanation: "Size withheld due to photo quality criteria check.",
    };
  }

  // Check uncalibrated / coin missing
  if (!isCoinDetected || typeof fingerItem.width_mm !== "number" || fingerItem.width_mm <= 0) {
    return {
      finger: fingerItem.finger,
      fingerKey,
      colorHex: fingerItem.colorHex,
      measuredWidthMm: fingerItem.width_mm,
      recommendedSize: "Pending Calibration",
      displayRecommendation: `${fingerItem.finger} → Pending Coin`,
      fitStatus: "uncalibrated",
      explanation: "Requires verified ₹10 coin scale to calibrate millimeter width.",
    };
  }

  const measured = fingerItem.width_mm;

  // FORMAT B: Nail-width ranges mapped to press-on size number
  if (
    brand.sizingChart.format === "width_ranges" &&
    brand.sizingChart.ranges &&
    brand.sizingChart.ranges.length > 0
  ) {
    const rangeMatch = matchWidthToRange(measured, brand.sizingChart.ranges);
    return {
      finger: fingerItem.finger,
      fingerKey,
      colorHex: fingerItem.colorHex,
      measuredWidthMm: measured,
      recommendedSize: rangeMatch.sizeLabel,
      displayRecommendation: `${fingerItem.finger} → Size ${rangeMatch.sizeLabel}`,
      chartRange: rangeMatch.chartRange,
      fitStatus: rangeMatch.fitStatus,
      explanation: rangeMatch.explanation,
    };
  }

  // FORMAT A: Per-size finger matrix (XS, S, M, L)
  if (!fingerKey) {
    return {
      finger: fingerItem.finger,
      fingerKey: null,
      colorHex: fingerItem.colorHex,
      measuredWidthMm: fingerItem.width_mm,
      recommendedSize: "Unknown Finger",
      displayRecommendation: `${fingerItem.finger} → Check Chart`,
      fitStatus: "no_match",
      explanation: "Unable to identify finger position for brand chart mapping.",
    };
  }

  const chartSizes = brand.sizingChart.sizes || {};
  const sizeKeys = Object.keys(chartSizes);

  // Filter sizes where chartWidth >= measured
  const validCandidates: Array<{ sizeKey: string; chartWidth: number; diff: number }> = [];

  for (const sKey of sizeKeys) {
    const dims = chartSizes[sKey];
    if (!dims) continue;
    const chartWidth = dims[fingerKey];
    if (typeof chartWidth === "number" && chartWidth >= measured) {
      validCandidates.push({
        sizeKey: sKey,
        chartWidth,
        diff: chartWidth - measured,
      });
    }
  }

  // Sort candidates by diff ascending (smallest >= measured)
  validCandidates.sort((a, b) => a.diff - b.diff);

  const bestCandidate = validCandidates[0];

  // If no size >= measured OR even smallest >= measured has > 2.5mm gap (too loose)
  if (!bestCandidate || bestCandidate.diff > 2.5) {
    return {
      finger: fingerItem.finger,
      fingerKey,
      colorHex: fingerItem.colorHex,
      measuredWidthMm: measured,
      recommendedSize: "No matching size",
      displayRecommendation: `${fingerItem.finger} → No match`,
      fitStatus: "no_match",
      explanation: bestCandidate
        ? `Closest available (${bestCandidate.sizeKey}: ${bestCandidate.chartWidth}mm) is +${bestCandidate.diff.toFixed(1)}mm too wide.`
        : `Measured ${measured.toFixed(1)}mm exceeds maximum size in this brand's chart.`,
    };
  }

  const isExact = bestCandidate.diff <= 0.15;

  return {
    finger: fingerItem.finger,
    fingerKey,
    colorHex: fingerItem.colorHex,
    measuredWidthMm: measured,
    recommendedSize: bestCandidate.sizeKey,
    displayRecommendation: `${fingerItem.finger} → Size ${bestCandidate.sizeKey}`,
    chartWidthMm: bestCandidate.chartWidth,
    differenceMm: bestCandidate.diff,
    fitStatus: isExact ? "exact" : "recommended",
    explanation: isExact
      ? `Exact match (${bestCandidate.chartWidth}mm vs measured ${measured.toFixed(1)}mm)`
      : `Recommended size ${bestCandidate.sizeKey} (${bestCandidate.chartWidth}mm, +${bestCandidate.diff.toFixed(1)}mm buffer)`,
  };
}

/**
 * Match full AI measurement results against a selected brand.
 */
export function matchResultsToBrand(results: NailSizeResult, brand: Brand): BrandMatchResult {
  const isValidationPassed = !results.validation || results.validation.passed;
  const isCoinDetected = Boolean(results.coin_detected);

  const rawItems = results.measurements || results.leftHand || [];

  const getSortKey = (name: string): number => {
    const numMatch = name.match(/nail\s*(\d+)/i);
    if (numMatch) return parseInt(numMatch[1], 10);
    const lower = name.toLowerCase();
    if (lower.includes("thumb")) return 1;
    if (lower.includes("index")) return 2;
    if (lower.includes("mid")) return 3;
    if (lower.includes("ring")) return 4;
    if (lower.includes("pink")) return 5;
    return 99;
  };

  const sortedItems = rawItems.slice().sort((a, b) => getSortKey(a.finger) - getSortKey(b.finger));

  const fingerFits = sortedItems.map((item) =>
    matchFingerToBrand(item, brand, isValidationPassed, isCoinDetected)
  );

  // Determine overall set uniformity
  const recommendedSizes = fingerFits
    .map((f) => f.recommendedSize)
    .filter(
      (s) =>
        ![
          "Pending Calibration",
          "Validation Withheld",
          "No matching size",
          "Unknown Finger",
          "Check chart",
        ].includes(s)
    );

  const uniqueSizes = Array.from(new Set(recommendedSizes));
  const isUniformSet = uniqueSizes.length === 1 && recommendedSizes.length >= 4;

  let overallSetSize = "Custom Mixed Set";
  if (isUniformSet) {
    overallSetSize = `Standard ${uniqueSizes[0]} Full Set`;
  } else if (recommendedSizes.length > 0) {
    overallSetSize = `Custom Set (${fingerFits.map((f) => `${f.finger.replace("Nail ", "N")}:${f.recommendedSize}`).join(", ")})`;
  } else {
    overallSetSize = "No standard set match";
  }

  return {
    brand,
    fingerFits,
    overallSetSize,
    isUniformSet,
    ruleExplanation:
      brand.sizingChart.format === "width_ranges"
        ? "Recommendation matches each measured nail width to your manufacturer's millimeter range brackets."
        : "Recommendation selects the closest available brand chart size with width greater than or equal to your calibrated nail width.",
    matchTimestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}
