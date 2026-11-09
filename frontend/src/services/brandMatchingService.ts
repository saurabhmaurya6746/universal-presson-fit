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

// ==============================================================================
// Universal Multi-Format Matching Functions for Modern Brand Sizing Journey
// ==============================================================================

export interface PresetSetComparisonItem {
  finger: string;
  fingerKey: keyof FingerWidthMap | null;
  measuredWidthMm?: number;
  presetWidthMm?: number;
  diffMm?: number;
  isExact: boolean;
}

export interface PresetSetMatchOutput {
  recommendedSet: string;
  totalDiffMm: number;
  availableSets: string[];
  fingerComparisons: PresetSetComparisonItem[];
  allSetsComparison: Array<{
    setKey: string;
    totalDiff: number;
    items: PresetSetComparisonItem[];
  }>;
  disclaimer: string;
}

export function matchPresetSetBrand(
  results: NailSizeResult,
  chartSizes: Record<string, FingerWidthMap>
): PresetSetMatchOutput {
  const rawItems = results.measurements || results.leftHand || results.rightHand || [];
  const getSortKey = (name: string): number => {
    const lower = name.toLowerCase();
    if (lower.includes("thumb") || lower.includes("nail 1")) return 1;
    if (lower.includes("index") || lower.includes("nail 2")) return 2;
    if (lower.includes("mid") || lower.includes("nail 3")) return 3;
    if (lower.includes("ring") || lower.includes("nail 4")) return 4;
    if (lower.includes("pink") || lower.includes("nail 5")) return 5;
    return 99;
  };
  const sortedItems = rawItems.slice().sort((a, b) => getSortKey(a.finger) - getSortKey(b.finger));

  const availableSets = Object.keys(chartSizes);
  if (availableSets.length === 0) {
    return {
      recommendedSet: "None",
      totalDiffMm: 0,
      availableSets: [],
      fingerComparisons: [],
      allSetsComparison: [],
      disclaimer: "No preset sets defined in this brand's sizing chart.",
    };
  }

  const allSetsComparison = availableSets.map((sKey) => {
    const setSpecs = chartSizes[sKey];
    let totalDiff = 0;
    const items: PresetSetComparisonItem[] = sortedItems.map((item) => {
      const fKey = resolveFingerKey(item.finger);
      const measured = typeof item.width_mm === "number" ? item.width_mm : undefined;
      const target = fKey && setSpecs ? setSpecs[fKey] : undefined;
      let diff: number | undefined = undefined;
      let isExact = false;
      if (measured !== undefined && target !== undefined) {
        diff = target - measured;
        totalDiff += Math.abs(diff);
        isExact = Math.abs(diff) <= 0.2;
      }
      return {
        finger: item.finger,
        fingerKey: fKey,
        measuredWidthMm: measured,
        presetWidthMm: target,
        diffMm: diff,
        isExact,
      };
    });

    return {
      setKey: sKey,
      totalDiff,
      items,
    };
  });

  // Sort by smallest totalDiff to find best matching preset set
  const sortedSets = allSetsComparison.slice().sort((a, b) => a.totalDiff - b.totalDiff);
  const bestSet = sortedSets[0];

  return {
    recommendedSet: bestSet.setKey,
    totalDiffMm: bestSet.totalDiff,
    availableSets,
    fingerComparisons: bestSet.items,
    allSetsComparison,
    disclaimer:
      "The closest preset is an automated recommendation, not a guaranteed fit. Press-on nails are manufactured in standard sets; natural fingernails may fit between sizes.",
  };
}

export interface NumberedSizeMatchOutput {
  fingerMatches: Array<{
    finger: string;
    measuredWidthMm?: number;
    size: string;
    matchedWidthDisplay: string;
    isApproximate: boolean;
    typicalFinger?: string | null;
    diffMm: number;
    fitStatus: "exact" | "approximate" | "out_of_range";
  }>;
  summarySetDisplay: string;
  disclaimer: string;
}

export function matchNumberedSizeBrand(
  results: NailSizeResult,
  numberedSizes: Array<{
    size: string;
    width_mm?: number | null;
    min_width_mm?: number | null;
    max_width_mm?: number | null;
    is_approximate?: boolean;
    typical_finger?: string | null;
  }>
): NumberedSizeMatchOutput {
  const rawItems = results.measurements || results.leftHand || results.rightHand || [];
  const getSortKey = (name: string): number => {
    const lower = name.toLowerCase();
    if (lower.includes("thumb") || lower.includes("nail 1")) return 1;
    if (lower.includes("index") || lower.includes("nail 2")) return 2;
    if (lower.includes("mid") || lower.includes("nail 3")) return 3;
    if (lower.includes("ring") || lower.includes("nail 4")) return 4;
    if (lower.includes("pink") || lower.includes("nail 5")) return 5;
    return 99;
  };
  const sortedItems = rawItems.slice().sort((a, b) => getSortKey(a.finger) - getSortKey(b.finger));

  if (!numberedSizes || numberedSizes.length === 0) {
    return {
      fingerMatches: [],
      summarySetDisplay: "No numbered sizes available",
      disclaimer: "No individual numbered sizes published for this brand.",
    };
  }

  const fingerMatches = sortedItems.map((item) => {
    const measured = item.width_mm;
    if (typeof measured !== "number" || measured <= 0) {
      return {
        finger: item.finger,
        measuredWidthMm: measured,
        size: "—",
        matchedWidthDisplay: "—",
        isApproximate: false,
        typicalFinger: null,
        diffMm: 0,
        fitStatus: "out_of_range" as const,
      };
    }

    // Match candidate with minimal deviation
    let bestEntry = numberedSizes[0];
    let minDeviation = Infinity;

    for (const entry of numberedSizes) {
      let targetCenter = 0;
      let inRange = false;

      if (entry.min_width_mm != null && entry.max_width_mm != null) {
        if (measured >= entry.min_width_mm && measured <= entry.max_width_mm) {
          inRange = true;
          targetCenter = measured;
        } else {
          targetCenter = (entry.min_width_mm + entry.max_width_mm) / 2;
        }
      } else if (entry.width_mm != null) {
        targetCenter = entry.width_mm;
      }

      const dev = inRange ? 0 : Math.abs(measured - targetCenter);
      if (dev < minDeviation) {
        minDeviation = dev;
        bestEntry = entry;
      }
    }

    const isApprox = Boolean(bestEntry.is_approximate);
    let matchedDisplay = "—";
    if (bestEntry.min_width_mm != null && bestEntry.max_width_mm != null && bestEntry.min_width_mm !== bestEntry.max_width_mm) {
      matchedDisplay = `${isApprox ? "~" : ""}${bestEntry.min_width_mm}–${bestEntry.max_width_mm} mm`;
    } else if (bestEntry.width_mm != null) {
      matchedDisplay = `${isApprox ? "~" : ""}${bestEntry.width_mm} mm`;
    }

    const fitStatus: "exact" | "approximate" | "out_of_range" =
      minDeviation <= 0.2 && !isApprox ? "exact" : minDeviation <= 2.5 ? "approximate" : "out_of_range";

    return {
      finger: item.finger,
      measuredWidthMm: measured,
      size: bestEntry.size,
      matchedWidthDisplay: matchedDisplay,
      isApproximate: isApprox,
      typicalFinger: bestEntry.typical_finger,
      diffMm: minDeviation,
      fitStatus,
    };
  });

  const summaryParts = fingerMatches
    .filter((f) => f.size !== "—")
    .map((f) => `${f.finger.replace("Nail ", "N")}: #${f.size} (${f.matchedWidthDisplay})`);

  return {
    fingerMatches,
    summarySetDisplay: summaryParts.join(" • ") || "No matches found",
    disclaimer:
      "Matches preserve original brand size numbering, approximate indicators (~), and ranges. These are approximate matches and do not claim guaranteed sizing.",
  };
}

export interface ShapeRangeMatchOutput {
  selectedShape: string;
  availableShapes: string[];
  shapeEntry?: {
    shape: string;
    length_min_mm?: number | null;
    length_max_mm?: number | null;
    width_min_mm?: number | null;
    width_max_mm?: number | null;
    thickness_mm?: number | null;
  };
  fingerComparisons: Array<{
    finger: string;
    measuredWidthMm?: number;
    minWidthMm?: number;
    maxWidthMm?: number;
    isWithinRange: boolean;
    statusText: string;
  }>;
  lengthRangeDisplay: string;
  widthRangeDisplay: string;
  thicknessDisplay: string;
  disclaimer: string;
}

export function matchShapeRangeBrand(
  results: NailSizeResult,
  shapeRanges: Array<{
    shape: string;
    length_min_mm?: number | null;
    length_max_mm?: number | null;
    width_min_mm?: number | null;
    width_max_mm?: number | null;
    thickness_mm?: number | null;
  }>,
  selectedShapeName?: string
): ShapeRangeMatchOutput {
  const availableShapes = shapeRanges.map((sr) => sr.shape);
  const activeShapeName =
    selectedShapeName && availableShapes.includes(selectedShapeName)
      ? selectedShapeName
      : availableShapes[0] || "";

  const shapeEntry = shapeRanges.find((sr) => sr.shape === activeShapeName);

  const rawItems = results.measurements || results.leftHand || results.rightHand || [];
  const getSortKey = (name: string): number => {
    const lower = name.toLowerCase();
    if (lower.includes("thumb") || lower.includes("nail 1")) return 1;
    if (lower.includes("index") || lower.includes("nail 2")) return 2;
    if (lower.includes("mid") || lower.includes("nail 3")) return 3;
    if (lower.includes("ring") || lower.includes("nail 4")) return 4;
    if (lower.includes("pink") || lower.includes("nail 5")) return 5;
    return 99;
  };
  const sortedItems = rawItems.slice().sort((a, b) => getSortKey(a.finger) - getSortKey(b.finger));

  const minW = shapeEntry?.width_min_mm != null ? shapeEntry.width_min_mm : undefined;
  const maxW = shapeEntry?.width_max_mm != null ? shapeEntry.width_max_mm : undefined;

  const fingerComparisons = sortedItems.map((item) => {
    const measured = item.width_mm;
    let isWithin = false;
    let statusText = "No shape bounds defined";

    if (typeof measured === "number" && minW !== undefined && maxW !== undefined) {
      if (measured >= minW && measured <= maxW) {
        isWithin = true;
        statusText = `Within shape silhouette width span (${minW.toFixed(2)}–${maxW.toFixed(2)} mm)`;
      } else if (measured < minW) {
        statusText = `Narrower than silhouette minimum (-${(minW - measured).toFixed(2)} mm)`;
      } else {
        statusText = `Wider than silhouette maximum (+${(measured - maxW).toFixed(2)} mm)`;
      }
    }

    return {
      finger: item.finger,
      measuredWidthMm: measured,
      minWidthMm: minW,
      maxWidthMm: maxW,
      isWithinRange: isWithin,
      statusText,
    };
  });

  const lengthRangeDisplay =
    shapeEntry?.length_min_mm != null && shapeEntry?.length_max_mm != null
      ? `${shapeEntry.length_min_mm.toFixed(2)}–${shapeEntry.length_max_mm.toFixed(2)} mm`
      : "Not provided";

  const widthRangeDisplay =
    minW != null && maxW != null
      ? `${minW.toFixed(2)}–${maxW.toFixed(2)} mm`
      : "Not provided";

  const thicknessDisplay =
    shapeEntry?.thickness_mm != null
      ? `${shapeEntry.thickness_mm.toFixed(1)} mm`
      : "Not provided";

  return {
    selectedShape: activeShapeName,
    availableShapes,
    shapeEntry,
    fingerComparisons,
    lengthRangeDisplay,
    widthRangeDisplay,
    thicknessDisplay,
    disclaimer:
      "These published measurements represent shape-level bounding ranges across the silhouette collection, not individual nail size numbers. Individual tip size recommendations are not generated.",
  };
}

export interface LengthOnlyNumberedShapeEntry {
  size: string;
  length_mm: number;
}

export interface LengthOnlyNumberedMatchResult {
  selectedShape: string;
  availableShapes: string[];
  shapeLengths: LengthOnlyNumberedShapeEntry[];
  lengthGuideMessage: string;
  exactSizeMatchingAvailable: false;
  disclaimer: string;
}

/**
 * Format E: Length-Only Numbered Sizing (The Nailest)
 *
 * Provides exact millimeter vertical length specifications for numbered tips #0 to #9
 * across manufacturer shapes (Short Oval, Long Stiletto, etc.).
 *
 * STRICT RESTRICTIONS:
 * - Does NOT estimate width values.
 * - Does NOT generate recommended size numbers from width measurements.
 * - Does NOT display misleading fit percentages or confidence scores.
 * - Explains clearly that width measurements are not provided by this brand
 *   and exact size matching is currently unavailable.
 */
export function matchLengthOnlyNumberedBrand(
  _results: NailSizeResult,
  chartData: {
    length_numbered_sizes?: Record<string, Record<string, number>>;
    sizing_chart_entries?: Array<{
      shape?: string | null;
      size_label: string;
      length_mm?: number | null;
      display_order?: number;
    }>;
  },
  selectedShape?: string
): LengthOnlyNumberedMatchResult {
  const shapesMap: Record<string, Record<string, number>> = { ...(chartData.length_numbered_sizes || {}) };

  // If length_numbered_sizes was not pre-populated, build it from sizing_chart_entries
  if (Object.keys(shapesMap).length === 0 && chartData.sizing_chart_entries) {
    for (const e of chartData.sizing_chart_entries) {
      if (e.length_mm != null) {
        const shp = e.shape || "Standard";
        if (!shapesMap[shp]) shapesMap[shp] = {};
        shapesMap[shp][e.size_label] = Number(e.length_mm);
      }
    }
  }

  const availableShapes = Object.keys(shapesMap);
  const activeShapeName =
    selectedShape && shapesMap[selectedShape]
      ? selectedShape
      : availableShapes[0] || "Short Oval";

  const sizeDict = shapesMap[activeShapeName] || {};

  // Natural sort #0 to #9
  const shapeLengths: LengthOnlyNumberedShapeEntry[] = Object.entries(sizeDict)
    .map(([size, len]) => ({
      size: size.startsWith("#") ? size : `#${size}`,
      length_mm: len,
    }))
    .sort((a, b) => {
      const numA = parseInt(a.size.replace("#", ""), 10);
      const numB = parseInt(b.size.replace("#", ""), 10);
      return (isNaN(numA) ? 0 : numA) - (isNaN(numB) ? 0 : numB);
    });

  return {
    selectedShape: activeShapeName,
    availableShapes,
    shapeLengths,
    lengthGuideMessage:
      "Length information is available, but width measurements are not provided by this brand.",
    exactSizeMatchingAvailable: false,
    disclaimer:
      "Exact size matching is currently unavailable because this brand provides only nail tip lengths without width specifications. Use the length guide below to review vertical length extensions.",
  };
}
