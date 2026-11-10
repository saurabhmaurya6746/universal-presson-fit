import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Info,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { publicBrandRepository } from "@/services/publicBrandRepository";
import {
  matchPresetSetBrand,
  matchNumberedSizeBrand,
  matchShapeRangeBrand,
  matchLengthOnlyNumberedBrand,
  matchResultsToBrand,
} from "@/services/brandMatchingService";
import type { BrandSizingChart, PublicBrandProfile } from "@/types/brand";
import type { NailSizeResult } from "@/types";

export interface BrandFitComparisonProps {
  results: NailSizeResult;
  selectedBrandId?: string | null;
  onBrandSelect: (brandId: string | null) => void;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
}

const DEFAULT_DOT_PALETTE = ["#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

/**
 * Inspect a brand's actual published sizing chart to extract any supported shape-specific charts.
 * Only brands with >1 distinct shape chart show the conditional Shape dropdown.
 */
function getAvailableShapeCharts(chart?: BrandSizingChart): string[] {
  if (!chart) return [];

  if (chart.format === "shape_range" && chart.shape_ranges && chart.shape_ranges.length > 0) {
    return Array.from(
      new Set(chart.shape_ranges.map((sr) => sr.shape?.trim()).filter((s): s is string => Boolean(s)))
    );
  }

  if (chart.format === "length_only_numbered") {
    if (chart.length_numbered_sizes && Object.keys(chart.length_numbered_sizes).length > 0) {
      return Object.keys(chart.length_numbered_sizes);
    }
    if (chart.sizing_chart_entries && chart.sizing_chart_entries.length > 0) {
      return Array.from(
        new Set(
          chart.sizing_chart_entries
            .filter((e) => e.length_mm != null && e.shape)
            .map((e) => e.shape!.trim())
        )
      );
    }
  }

  if (chart.sizing_chart_entries && chart.sizing_chart_entries.length > 0) {
    return Array.from(
      new Set(
        chart.sizing_chart_entries
          .map((e) => e.shape?.trim())
          .filter((s): s is string => Boolean(s))
      )
    );
  }

  return [];
}

function getNailGridClass(count: number): string {
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count === 3) return "grid-cols-2 sm:grid-cols-3";
  if (count === 4) return "grid-cols-2 lg:grid-cols-4";
  return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
}

interface NailResultCardProps {
  fingerLabel: string;
  dotColor: string;
  primaryText: string;
  primaryTone?: "default" | "unavailable";
  measuredWidthMm?: number;
  subLabel?: string;
}

function NailResultCard({
  fingerLabel,
  dotColor,
  primaryText,
  primaryTone = "default",
  measuredWidthMm,
  subLabel,
}: NailResultCardProps) {
  return (
    <div className="flex flex-col items-center justify-between rounded-2xl border border-lavender/70 bg-gradient-to-b from-blush/20 via-card to-lavender/20 p-4 text-center shadow-xs transition-all hover:border-lavender-deep/50">
      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span
          className="size-2.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <span>{fingerLabel}</span>
      </div>

      <div className="my-2.5">
        <div
          className={
            primaryTone === "unavailable"
              ? "font-display text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-400"
              : "font-display text-2xl sm:text-3xl font-bold tracking-tight text-primary"
          }
        >
          {primaryText}
        </div>
        {subLabel && (
          <div className="mt-0.5 text-[11px] font-medium text-muted-foreground leading-tight">
            {subLabel}
          </div>
        )}
      </div>

      <div className="w-full border-t border-lavender/40 pt-2 font-mono text-xs font-semibold text-foreground/80">
        {typeof measuredWidthMm === "number" && measuredWidthMm > 0
          ? `≈ ${measuredWidthMm.toFixed(2)} mm`
          : "Uncalibrated"}
      </div>
    </div>
  );
}

export function BrandFitComparison({
  results,
  selectedBrandId,
  onBrandSelect,
  sectionRef,
}: BrandFitComparisonProps) {
  const [brands, setBrands] = useState<PublicBrandProfile[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [activeBrandDetail, setActiveBrandDetail] = useState<PublicBrandProfile | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [selectedShape, setSelectedShape] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("recommended");
  const [logoFailed, setLogoFailed] = useState(false);

  // Map each detected nail label to its overlay color so cards stay tied to the photo markers
  const fingerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const raw = results.measurements || results.leftHand || results.rightHand || [];
    raw.forEach((item, idx) => {
      map.set(item.finger, item.colorHex || DEFAULT_DOT_PALETTE[idx % DEFAULT_DOT_PALETTE.length]);
    });
    return map;
  }, [results]);

  const isValidationPassed = !results.validation || Boolean(results.validation.passed);
  const isCoinDetected = Boolean(results.coin_detected);
  const canMatchReliableWidths = isValidationPassed && isCoinDetected;

  const loadBrands = useCallback(async () => {
    setIsLoadingBrands(true);
    setLoadingError(null);
    try {
      const data = await publicBrandRepository.getPublicBrands();
      setBrands(data.filter((b) => Boolean(b.sizingChart)));
    } catch (err) {
      setLoadingError(err instanceof Error ? err.message : "Failed to load brand catalog.");
    } finally {
      setIsLoadingBrands(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  // Reset shape selection & load chart details whenever brand changes
  useEffect(() => {
    let isCurrent = true;
    setSelectedShape("");
    setSelectedPreset("recommended");
    setLogoFailed(false);

    if (!selectedBrandId) {
      setActiveBrandDetail(null);
      setIsLoadingDetail(false);
      return;
    }

    // Use already-loaded public brand catalog data immediately to eliminate round-trip lag
    const cachedBrand = brands.find(
      (b) => b.slug === selectedBrandId || b.id === selectedBrandId
    );
    if (cachedBrand?.sizingChart) {
      setActiveBrandDetail(cachedBrand);
      setIsLoadingDetail(false);
      return;
    }

    setActiveBrandDetail(null);

    const fetchDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const detail = await publicBrandRepository.getPublicBrandBySlugOrId(selectedBrandId);
        if (isCurrent) {
          setActiveBrandDetail(detail);
        }
      } catch (err) {
        console.error("Failed to load brand chart details:", err);
      } finally {
        if (isCurrent) setIsLoadingDetail(false);
      }
    };

    fetchDetail();
    return () => {
      isCurrent = false;
    };
  }, [selectedBrandId, brands]);

  const isBrandDetailReady =
    Boolean(selectedBrandId) &&
    Boolean(activeBrandDetail) &&
    (activeBrandDetail?.slug === selectedBrandId || activeBrandDetail?.id === selectedBrandId);

  const chart = isBrandDetailReady ? activeBrandDetail?.sizingChart : undefined;
  const chartFormat =
    chart?.format || (chart?.ranges && chart.ranges.length > 0 ? "width_ranges" : "preset_set");

  // Inspect actual available shape-specific charts on the selected brand
  const availableShapes = useMemo(() => getAvailableShapeCharts(chart), [chart]);
  const hasMultipleShapeCharts = availableShapes.length > 1;
  const activeShapeForCalculation = hasMultipleShapeCharts
    ? selectedShape
    : availableShapes[0] || "";

  // Wait for shape selection when brand has multiple shape-specific charts
  const isWaitingForShapeSelection =
    isBrandDetailReady && Boolean(chart) && hasMultipleShapeCharts && !selectedShape;
  const isReadyToShowResults =
    isBrandDetailReady && !isLoadingDetail && (!hasMultipleShapeCharts || Boolean(selectedShape));

  // Filter raw entries by shape ONLY if a generic format carries per-shape entries
  const scopedChart = useMemo(() => {
    if (!chart) return undefined;
    if (
      !activeShapeForCalculation ||
      !chart.sizing_chart_entries ||
      chartFormat === "shape_range" ||
      chartFormat === "length_only_numbered"
    ) {
      return chart;
    }
    const matchingEntries = chart.sizing_chart_entries.filter(
      (e) => e.shape?.trim() === activeShapeForCalculation
    );
    if (matchingEntries.length === 0) return chart;

    if (chartFormat === "numbered_size") {
      return {
        ...chart,
        numbered_sizes: matchingEntries.map((e) => ({
          size: e.size_label,
          width_mm: e.width_mm,
          min_width_mm: e.min_width_mm,
          max_width_mm: e.max_width_mm,
          is_approximate: e.is_approximate,
          typical_finger: e.typical_finger,
        })),
      };
    }
    if (chartFormat === "width_ranges") {
      return {
        ...chart,
        ranges: matchingEntries
          .filter((e) => e.min_width_mm != null && e.max_width_mm != null)
          .map((e) => ({
            sizeLabel: e.size_label,
            minMm: Number(e.min_width_mm),
            maxMm: Number(e.max_width_mm),
          })),
      };
    }
    return chart;
  }, [chart, chartFormat, activeShapeForCalculation]);

  // Format A: Preset Sets (PRESSE, Aura Luxury, LuxeTip)
  const presetMatch = useMemo(() => {
    if (!isReadyToShowResults || !scopedChart) return null;
    if (chartFormat !== "preset_set" && chartFormat !== "per_size" && chartFormat !== "per_size_fingers") {
      return null;
    }
    if (!scopedChart.sizes || Object.keys(scopedChart.sizes).length === 0) return null;
    return matchPresetSetBrand(results, scopedChart.sizes);
  }, [isReadyToShowResults, chartFormat, scopedChart, results]);

  const activePresetComparison = useMemo(() => {
    if (!presetMatch) return null;
    if (selectedPreset === "recommended" || !selectedPreset) {
      return {
        setKey: presetMatch.recommendedSet,
        totalDiff: presetMatch.totalDiffMm,
        items: presetMatch.fingerComparisons,
        isAutoRecommended: true,
      };
    }
    const matched = presetMatch.allSetsComparison?.find((s) => s.setKey === selectedPreset);
    if (matched) {
      return {
        setKey: matched.setKey,
        totalDiff: matched.totalDiff,
        items: matched.items,
        isAutoRecommended: matched.setKey === presetMatch.recommendedSet,
      };
    }
    return {
      setKey: presetMatch.recommendedSet,
      totalDiff: presetMatch.totalDiffMm,
      items: presetMatch.fingerComparisons,
      isAutoRecommended: true,
    };
  }, [presetMatch, selectedPreset]);

  // Format B: Numbered Sizes (Joyee)
  const numberedMatch = useMemo(() => {
    if (!isReadyToShowResults || !scopedChart || chartFormat !== "numbered_size") return null;
    if (!scopedChart.numbered_sizes || scopedChart.numbered_sizes.length === 0) return null;
    return matchNumberedSizeBrand(results, scopedChart.numbered_sizes);
  }, [isReadyToShowResults, chartFormat, scopedChart, results]);

  // Format C: Shape-Based Bounds (Glamnetic)
  const shapeMatch = useMemo(() => {
    if (!isReadyToShowResults || !chart || chartFormat !== "shape_range") return null;
    if (!chart.shape_ranges || chart.shape_ranges.length === 0) return null;
    return matchShapeRangeBrand(results, chart.shape_ranges, activeShapeForCalculation);
  }, [isReadyToShowResults, chartFormat, chart, activeShapeForCalculation, results]);

  // Format D: Millimeter Width Ranges (Velvet Claws)
  const widthRangeMatch = useMemo(() => {
    if (!isReadyToShowResults || !activeBrandDetail || !scopedChart || chartFormat !== "width_ranges") {
      return null;
    }
    return matchResultsToBrand(results, { ...activeBrandDetail, sizingChart: scopedChart } as any);
  }, [isReadyToShowResults, chartFormat, activeBrandDetail, scopedChart, results]);

  // Format E: Length-Only Numbered (The Nailest — no width specs)
  const lengthOnlyMatch = useMemo(() => {
    if (!isReadyToShowResults || !chart || chartFormat !== "length_only_numbered") return null;
    return matchLengthOnlyNumberedBrand(results, chart, activeShapeForCalculation);
  }, [isReadyToShowResults, chartFormat, chart, activeShapeForCalculation, results]);

  const rawDetections = results.measurements || results.leftHand || results.rightHand || [];

  const resultHeading = activeBrandDetail
    ? activeShapeForCalculation
      ? `${activeBrandDetail.name} — ${activeShapeForCalculation}`
      : activeBrandDetail.name
    : "Brand Sizing Result";

  return (
    <div ref={sectionRef} className="space-y-6">
      {/* ==================================================================== */}
      {/* SELECT BRAND & CONDITIONAL SELECT SHAPE CARD                          */}
      {/* ==================================================================== */}
      <div className="rounded-3xl border border-lavender/70 bg-gradient-to-br from-card via-card to-blush/20 p-5 sm:p-8 shadow-soft">
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-xl bg-lavender/60 text-primary">
              <Sparkles className="size-4" />
            </span>
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Find Your Brand Size
            </h3>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Select a press-on nail brand{hasMultipleShapeCharts ? " and nail shape" : ""} to match your measured nail widths.
          </p>
        </div>

        {isLoadingBrands && (
          <div className="py-5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="size-3.5 animate-spin text-primary" />
            <span>Loading verified brand charts...</span>
          </div>
        )}

        {!isLoadingBrands && loadingError && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-center">
            <AlertCircle className="size-5 text-destructive mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-destructive">{loadingError}</p>
            <Button onClick={loadBrands} variant="outline" size="sm" className="mt-3 gap-1.5 text-xs">
              <RefreshCw className="size-3" />
              Retry Loading Brands
            </Button>
          </div>
        )}

        {!isLoadingBrands && !loadingError && (
          <div
            className={`grid grid-cols-1 gap-4 ${
              hasMultipleShapeCharts ? "sm:grid-cols-2" : "sm:grid-cols-1 sm:max-w-md"
            }`}
          >
            {/* Brand Dropdown */}
            <div className="space-y-1.5">
              <label
                htmlFor="brand-select-dropdown"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block"
              >
                Select Brand
              </label>
              <div className="relative">
                <select
                  id="brand-select-dropdown"
                  value={selectedBrandId || ""}
                  onChange={(e) => {
                    setSelectedShape("");
                    onBrandSelect(e.target.value || null);
                  }}
                  className="w-full appearance-none rounded-xl border border-lavender-deep/35 bg-background/95 px-4 py-3 pr-10 text-sm font-semibold text-foreground shadow-xs transition-all hover:border-lavender-deep/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="">Select Brand</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.slug}>
                      {brand.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-primary/70" />
              </div>
            </div>

            {/* Conditional Shape Dropdown — ONLY shown if selected brand has multiple shape-specific charts */}
            {hasMultipleShapeCharts && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label
                  htmlFor="shape-select-dropdown"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block"
                >
                  Select Shape
                </label>
                <div className="relative">
                  <select
                    id="shape-select-dropdown"
                    value={selectedShape}
                    onChange={(e) => setSelectedShape(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-lavender-deep/35 bg-background/95 px-4 py-3 pr-10 text-sm font-semibold text-foreground shadow-xs transition-all hover:border-lavender-deep/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="">Select Shape</option>
                    {availableShapes.map((shapeName) => (
                      <option key={shapeName} value={shapeName}>
                        {shapeName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-primary/70" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prompt to select brand when none chosen */}
      {!selectedBrandId && !isLoadingBrands && (
        <div className="rounded-3xl border border-dashed border-lavender/80 bg-card/70 p-8 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-lavender/45 text-primary">
            <Ruler className="size-5" />
          </div>
          <p className="font-display text-xl font-bold text-foreground">
            Choose a Brand to See Recommended Sizes
          </p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            Select a brand from the dropdown above to match your calibrated millimeter widths against their sizing chart.
          </p>
        </div>
      )}

      {/* Loading detail state */}
      {selectedBrandId && isLoadingDetail && (
        <div className="rounded-3xl border border-lavender/60 bg-card p-10 text-center shadow-xs">
          <RefreshCw className="size-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Loading brand sizing chart...</p>
        </div>
      )}

      {/* Wait for shape selection before showing recommendations on multi-shape brands */}
      {isWaitingForShapeSelection && (
        <div className="rounded-3xl border border-lavender/80 bg-lavender/15 p-8 text-center animate-in fade-in duration-200">
          <p className="font-display text-xl sm:text-2xl font-bold text-foreground">
            Select a Shape for {activeBrandDetail?.name}
          </p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            {activeBrandDetail?.name} uses shape-specific dimensions across {availableShapes.length} shapes. Choose a shape above to view your matched results.
          </p>
        </div>
      )}

      {/* ==================================================================== */}
      {/* BRAND-SPECIFIC RESULT CARD                                           */}
      {/* ==================================================================== */}
      {selectedBrandId && isReadyToShowResults && (
        <div className="rounded-3xl border border-lavender/70 bg-card p-5 sm:p-8 shadow-soft space-y-6 animate-in fade-in duration-200">
          {/* Result Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-lavender/50">
            <div className="flex items-center gap-3.5">
              {activeBrandDetail?.logo_url && !logoFailed ? (
                <img
                  src={activeBrandDetail.logo_url}
                  alt={`${activeBrandDetail.name} logo`}
                  onError={() => setLogoFailed(true)}
                  className="size-12 rounded-2xl object-contain border border-lavender/60 bg-background p-1.5 shadow-xs shrink-0"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-2xl bg-lavender/50 border border-lavender font-display font-bold text-primary text-xl shrink-0">
                  {activeBrandDetail?.name.charAt(0) || "B"}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                    {resultHeading}
                  </h4>
                  {(activeBrandDetail?.is_official || chart?.is_official) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mint/50 px-2.5 py-0.5 text-[10px] font-bold text-foreground border border-lavender/40">
                      <ShieldCheck className="size-3 text-emerald-700" />
                      Official Chart
                    </span>
                  )}
                </div>
                {activePresetComparison && (
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {activePresetComparison.isAutoRecommended
                      ? `Closest overall preset fit: Set ${activePresetComparison.setKey}`
                      : `Comparing Preset Set ${activePresetComparison.setKey}`}
                  </p>
                )}
              </div>
            </div>

            {/* Optional quick set pills ONLY for Preset Set brands (e.g. PRESSE XS/S/M/L) */}
            {presetMatch && activePresetComparison && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                  Compare Set:
                </span>
                {presetMatch.availableSets.map((setKey) => (
                  <button
                    key={setKey}
                    type="button"
                    onClick={() => setSelectedPreset(setKey)}
                    className={`inline-flex h-8 min-w-8 px-2.5 items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      setKey === activePresetComparison.setKey
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-lavender/25 text-foreground border border-lavender/60 hover:bg-lavender/50"
                    }`}
                    title={
                      setKey === presetMatch.recommendedSet
                        ? `Preset ${setKey} (Closest overall match)`
                        : `Switch to Preset ${setKey}`
                    }
                  >
                    {setKey}
                    {setKey === presetMatch.recommendedSet ? " ★" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Uncalibrated / Photo Validation Warning */}
          {!canMatchReliableWidths && chart && chartFormat !== "length_only_numbered" && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">
                  Verified calibration unavailable for brand size matching
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {!isCoinDetected
                    ? "The ₹10 reference coin could not be verified, so reliable brand size recommendations are withheld."
                    : results.validation?.primaryError ||
                      "Photo quality validation did not pass cleanly. Retake photo with clear overhead lighting to unlock exact size matching."}
                </p>
              </div>
            </div>
          )}

          {/* No chart defined */}
          {!chart && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-2">
              <AlertCircle className="size-6 text-amber-600 mx-auto" />
              <p className="font-display text-lg font-bold text-foreground">
                No Published Sizing Chart Available
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Reliable width-based matching is unavailable for this brand.
              </p>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* RESULT VIEW 1: NUMBERED SIZES (e.g. Joyee #0–#9)                 */}
          {/* ---------------------------------------------------------------- */}
          {chart && numberedMatch && (
            <div className="space-y-4">
              {numberedMatch.fingerMatches.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No detected nails available to match.
                </p>
              ) : (
                <div className={`grid gap-3 sm:gap-4 ${getNailGridClass(numberedMatch.fingerMatches.length)}`}>
                  {numberedMatch.fingerMatches.map((m, idx) => {
                    const dotColor =
                      fingerColorMap.get(m.finger) || DEFAULT_DOT_PALETTE[idx % DEFAULT_DOT_PALETTE.length];
                    const isAvailable =
                      canMatchReliableWidths && m.fitStatus !== "out_of_range" && m.size !== "—";

                    return (
                      <NailResultCard
                        key={`${m.finger}-${idx}`}
                        fingerLabel={m.finger}
                        dotColor={dotColor}
                        primaryText={isAvailable ? `Size ${m.size}` : "Unavailable"}
                        primaryTone={isAvailable ? "default" : "unavailable"}
                        measuredWidthMm={m.measuredWidthMm}
                        subLabel={
                          isAvailable
                            ? `Spec: ${m.matchedWidthDisplay}`
                            : !canMatchReliableWidths
                              ? "Needs calibration"
                              : "Outside chart range"
                        }
                      />
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {numberedMatch.disclaimer}
              </p>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* RESULT VIEW 2: WIDTH RANGES (e.g. Velvet Claws)                  */}
          {/* ---------------------------------------------------------------- */}
          {chart && widthRangeMatch && (
            <div className="space-y-4">
              {widthRangeMatch.fingerFits.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No detected nails available to match.
                </p>
              ) : (
                <div className={`grid gap-3 sm:gap-4 ${getNailGridClass(widthRangeMatch.fingerFits.length)}`}>
                  {widthRangeMatch.fingerFits.map((fit, idx) => {
                    const dotColor =
                      fit.colorHex ||
                      fingerColorMap.get(fit.finger) ||
                      DEFAULT_DOT_PALETTE[idx % DEFAULT_DOT_PALETTE.length];
                    const isAvailable =
                      canMatchReliableWidths &&
                      (fit.fitStatus === "exact" || fit.fitStatus === "recommended");

                    return (
                      <NailResultCard
                        key={`${fit.finger}-${idx}`}
                        fingerLabel={fit.finger}
                        dotColor={dotColor}
                        primaryText={isAvailable ? `Size ${fit.recommendedSize}` : "Unavailable"}
                        primaryTone={isAvailable ? "default" : "unavailable"}
                        measuredWidthMm={fit.measuredWidthMm}
                        subLabel={
                          isAvailable && fit.chartRange
                            ? `${fit.chartRange.minMm}–${fit.chartRange.maxMm} mm`
                            : fit.recommendedSize
                        }
                      />
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {widthRangeMatch.ruleExplanation}
              </p>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* RESULT VIEW 3: PRESET SETS (e.g. PRESSE XS–L)                    */}
          {/* ---------------------------------------------------------------- */}
          {chart && presetMatch && activePresetComparison && (
            <div className="space-y-4">
              {activePresetComparison.items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No detected nails available to match.
                </p>
              ) : (
                <div className={`grid gap-3 sm:gap-4 ${getNailGridClass(activePresetComparison.items.length)}`}>
                  {activePresetComparison.items.map((item, idx) => {
                    const dotColor =
                      fingerColorMap.get(item.finger) ||
                      DEFAULT_DOT_PALETTE[idx % DEFAULT_DOT_PALETTE.length];
                    const isAvailable =
                      canMatchReliableWidths &&
                      typeof item.measuredWidthMm === "number" &&
                      typeof item.presetWidthMm === "number";

                    return (
                      <NailResultCard
                        key={`${item.finger}-${idx}`}
                        fingerLabel={item.finger}
                        dotColor={dotColor}
                        primaryText={isAvailable ? `Set ${activePresetComparison.setKey}` : "Unavailable"}
                        primaryTone={isAvailable ? "default" : "unavailable"}
                        measuredWidthMm={item.measuredWidthMm}
                        subLabel={
                          isAvailable && item.presetWidthMm !== undefined
                            ? `Tip: ${item.presetWidthMm} mm (${item.diffMm !== undefined && item.diffMm >= 0 ? "+" : ""}${item.diffMm?.toFixed(1)} mm)`
                            : !canMatchReliableWidths
                              ? "Needs calibration"
                              : "No preset slot"
                        }
                      />
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {presetMatch.disclaimer}
              </p>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* RESULT VIEW 4: SHAPE SILHOUETTE BOUNDS (e.g. Glamnetic)          */}
          {/* ---------------------------------------------------------------- */}
          {chart && shapeMatch && (
            <div className="space-y-5">
              {/* Concise Silhouette Bounds Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-2xl border border-lavender/50 bg-lavender/15 px-4 py-3">
                  <span className="text-[11px] text-muted-foreground block">Shape Width Span</span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {shapeMatch.widthRangeDisplay}
                  </span>
                </div>
                <div className="rounded-2xl border border-lavender/50 bg-blush/15 px-4 py-3">
                  <span className="text-[11px] text-muted-foreground block">Shape Length Span</span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {shapeMatch.lengthRangeDisplay}
                  </span>
                </div>
                <div className="rounded-2xl border border-lavender/50 bg-lavender/15 px-4 py-3">
                  <span className="text-[11px] text-muted-foreground block">Tip Thickness</span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {shapeMatch.thicknessDisplay}
                  </span>
                </div>
              </div>

              {/* Honest explanation that shape bounds do not specify individual numbered tips */}
              <div className="flex items-start gap-2.5 rounded-2xl border border-lavender/60 bg-blush/15 p-3.5 text-xs text-foreground">
                <Info className="size-4 shrink-0 mt-0.5 text-primary" />
                <p className="leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Silhouette Span Compatibility:</strong>{" "}
                  {shapeMatch.disclaimer}
                </p>
              </div>

              {shapeMatch.fingerComparisons.length > 0 && (
                <div className={`grid gap-3 sm:gap-4 ${getNailGridClass(shapeMatch.fingerComparisons.length)}`}>
                  {shapeMatch.fingerComparisons.map((fc, idx) => {
                    const dotColor =
                      fingerColorMap.get(fc.finger) ||
                      DEFAULT_DOT_PALETTE[idx % DEFAULT_DOT_PALETTE.length];
                    const hasMeasurement =
                      canMatchReliableWidths && typeof fc.measuredWidthMm === "number";

                    return (
                      <NailResultCard
                        key={`${fc.finger}-${idx}`}
                        fingerLabel={fc.finger}
                        dotColor={dotColor}
                        primaryText={
                          !hasMeasurement
                            ? "Unavailable"
                            : fc.isWithinRange
                              ? "Fits Span"
                              : "Out of Span"
                        }
                        primaryTone={!hasMeasurement || !fc.isWithinRange ? "unavailable" : "default"}
                        measuredWidthMm={fc.measuredWidthMm}
                        subLabel={
                          !hasMeasurement
                            ? "Needs calibration"
                            : fc.isWithinRange
                              ? `Within ${shapeMatch.widthRangeDisplay}`
                              : fc.statusText.split("(")[0].trim()
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* RESULT VIEW 5: NO WIDTH SPECS / LENGTH-ONLY (e.g. The Nailest)   */}
          {/* ---------------------------------------------------------------- */}
          {chart && lengthOnlyMatch && (
            <div className="space-y-5">
              {/* Explicit Missing Width Explanation — never generate fake sizes */}
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-foreground">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Reliable width-based size matching is unavailable for {activeBrandDetail?.name}
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    {lengthOnlyMatch.disclaimer}
                  </p>
                </div>
              </div>

              {/* Detected Nails preserved honestly as Width Match Unavailable */}
              {rawDetections.length > 0 && (
                <div className={`grid gap-3 sm:gap-4 ${getNailGridClass(rawDetections.length)}`}>
                  {rawDetections.map((item, idx) => {
                    const dotColor =
                      item.colorHex ||
                      fingerColorMap.get(item.finger) ||
                      DEFAULT_DOT_PALETTE[idx % DEFAULT_DOT_PALETTE.length];
                    return (
                      <NailResultCard
                        key={`${item.finger}-${idx}`}
                        fingerLabel={item.finger}
                        dotColor={dotColor}
                        primaryText="Unavailable"
                        primaryTone="unavailable"
                        measuredWidthMm={item.width_mm}
                        subLabel="Width chart not provided"
                      />
                    );
                  })}
                </div>
              )}

              {/* Actual Published #0–#9 Tip Lengths for Selected Shape */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span className="font-semibold text-foreground">
                    Published {lengthOnlyMatch.selectedShape} Vertical Tip Lengths (#0–#9)
                  </span>
                  <span>Cuticle base to tip (mm)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {lengthOnlyMatch.shapeLengths.map((row) => (
                    <div
                      key={row.size}
                      className="rounded-xl border border-lavender/60 bg-lavender/15 px-3 py-2.5 text-center"
                    >
                      <span className="text-xs font-bold text-primary block">Tip {row.size}</span>
                      <span className="font-mono text-sm font-bold text-foreground">
                        {row.length_mm} mm L
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fallback when a brand chart exists with an empty/unsupported width dataset */}
          {chart &&
            !numberedMatch &&
            !widthRangeMatch &&
            !presetMatch &&
            !shapeMatch &&
            !lengthOnlyMatch && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-foreground">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Reliable width-based size matching is unavailable
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    This brand chart does not currently publish millimeter width specifications needed to generate size recommendations.
                  </p>
                </div>
              </div>
            )}

          {/* Concise Verification & Source Footer */}
          {chart?.source_url && (
            <div className="pt-3 border-t border-lavender/40 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Chart Unit: Millimeters ({chart.unit || "mm"})</span>
              <a
                href={chart.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Official Brand Guide <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
