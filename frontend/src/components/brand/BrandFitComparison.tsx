import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowLeftRight,
  Ruler,
  Info,
  CheckCircle2,
  RefreshCw,
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
import type { PublicBrandProfile, ChartFormat } from "@/types/brand";
import type { NailSizeResult } from "@/types";

export interface BrandFitComparisonProps {
  results: NailSizeResult;
  selectedBrandId?: string | null;
  onBrandSelect: (brandId: string | null) => void;
}

export function BrandFitComparison({
  results,
  selectedBrandId,
  onBrandSelect,
}: BrandFitComparisonProps) {
  const [brands, setBrands] = useState<PublicBrandProfile[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // Full detailed brand profile when a brand is active
  const [activeBrandDetail, setActiveBrandDetail] = useState<PublicBrandProfile | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Brand-specific secondary selectors:
  // For shape_range (Glamnetic) and length_only_numbered (The Nailest): selected shape
  const [selectedShape, setSelectedShape] = useState<string>("");
  // For preset_set (PRESSE): selected preset set (e.g. "recommended", "XS", "S", "M", "L")
  const [selectedPreset, setSelectedPreset] = useState<string>("recommended");
  // For numbered_size (Joyee): selected tip size (e.g. "all", "0", "1", ..., "9")
  const [selectedNumberedSize, setSelectedNumberedSize] = useState<string>("all");

  // Load published brands dynamically from public brand catalog API
  const loadBrands = useCallback(async () => {
    setIsLoadingBrands(true);
    setLoadingError(null);
    try {
      const data = await publicBrandRepository.getPublicBrands();
      // Filter to brands that have an active sizing chart
      const activeCharts = data.filter((b) => Boolean(b.sizingChart));
      setBrands(activeCharts);
    } catch (err) {
      setLoadingError(err instanceof Error ? err.message : "Failed to load brand catalog.");
    } finally {
      setIsLoadingBrands(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  // Load detailed brand profile with full chart data when selectedBrandId changes
  useEffect(() => {
    let isCurrent = true;
    if (!selectedBrandId) {
      setActiveBrandDetail(null);
      setSelectedShape("");
      setSelectedPreset("recommended");
      setSelectedNumberedSize("all");
      return;
    }

    const fetchDetail = async () => {
      setIsLoadingDetail(true);
      try {
        const detail = await publicBrandRepository.getPublicBrandBySlugOrId(selectedBrandId);
        if (isCurrent && detail) {
          setActiveBrandDetail(detail);
          // Default selected shape for shape_range and length_only_numbered
          if (detail.sizingChart?.shape_ranges && detail.sizingChart.shape_ranges.length > 0) {
            setSelectedShape(detail.sizingChart.shape_ranges[0].shape);
          } else if (detail.sizingChart?.length_numbered_sizes && Object.keys(detail.sizingChart.length_numbered_sizes).length > 0) {
            setSelectedShape(Object.keys(detail.sizingChart.length_numbered_sizes)[0]);
          } else if (detail.shapes && detail.shapes.length > 0) {
            setSelectedShape(detail.shapes[0]);
          }
          setSelectedPreset("recommended");
          setSelectedNumberedSize("all");
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
  }, [selectedBrandId]);

  // Format Helper
  const getFormatBadge = (format?: ChartFormat) => {
    switch (format) {
      case "preset_set":
      case "per_size":
      case "per_size_fingers":
        return { label: "Preset Sets (XS–L)", color: "bg-lavender/60 text-lavender-deep" };
      case "numbered_size":
        return { label: "Numbered Sizes (0–9)", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" };
      case "shape_range":
        return { label: "Shape-Based Dimension Ranges", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" };
      case "length_only_numbered":
        return { label: "Length-Only Numbered (#0–#9)", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" };
      case "width_ranges":
        return { label: "Width Range Specifications", color: "bg-secondary text-secondary-foreground" };
      default:
        return { label: "Standard Sizing", color: "bg-muted text-muted-foreground" };
    }
  };

  // Match calculations based on chart format
  const chart = activeBrandDetail?.sizingChart;
  const chartFormat = chart?.format || (chart?.ranges && chart.ranges.length > 0 ? "width_ranges" : "preset_set");

  // Format A: Preset Sets (PRESSE)
  const presetMatch = useMemo(() => {
    if (chartFormat !== "preset_set" && chartFormat !== "per_size" && chartFormat !== "per_size_fingers") return null;
    if (!chart?.sizes || Object.keys(chart.sizes).length === 0) return null;
    return matchPresetSetBrand(results, chart.sizes);
  }, [chartFormat, chart, results]);

  // Active preset comparison item based on user selection in dropdown 2
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
    if (chartFormat !== "numbered_size") return null;
    if (!chart?.numbered_sizes || chart.numbered_sizes.length === 0) return null;
    return matchNumberedSizeBrand(results, chart.numbered_sizes);
  }, [chartFormat, chart, results]);

  // Filtered or full numbered matches for display
  const displayedNumberedMatches = useMemo(() => {
    if (!numberedMatch) return [];
    if (selectedNumberedSize === "all" || !selectedNumberedSize) {
      return numberedMatch.fingerMatches;
    }
    const filtered = numberedMatch.fingerMatches.filter(
      (m) => String(m.size) === String(selectedNumberedSize)
    );
    return filtered.length > 0 ? filtered : numberedMatch.fingerMatches;
  }, [numberedMatch, selectedNumberedSize]);

  // Format C: Shape-Based Ranges (Glamnetic)
  const shapeMatch = useMemo(() => {
    if (chartFormat !== "shape_range") return null;
    if (!chart?.shape_ranges || chart.shape_ranges.length === 0) return null;
    return matchShapeRangeBrand(results, chart.shape_ranges, selectedShape);
  }, [chartFormat, chart, selectedShape, results]);

  // Format D: Legacy / Width Ranges
  const widthRangeMatch = useMemo(() => {
    if (chartFormat !== "width_ranges") return null;
    if (!activeBrandDetail) return null;
    return matchResultsToBrand(results, activeBrandDetail as any);
  }, [chartFormat, activeBrandDetail, results]);

  // Format E: Length-Only Numbered (The Nailest)
  const lengthOnlyMatch = useMemo(() => {
    if (chartFormat !== "length_only_numbered") return null;
    if (!chart) return null;
    return matchLengthOnlyNumberedBrand(results, chart, selectedShape);
  }, [chartFormat, chart, selectedShape, results]);

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* SECTION C — BRAND SELECTION CONTROLS (DROPDOWNS)                     */}
      {/* ==================================================================== */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-3.5" />
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Find Your Brand Size
              </h3>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Select your press-on nail brand to explore its available sizing information.
            </p>
          </div>

          {selectedBrandId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBrandSelect(null)}
              className="gap-1.5 text-xs font-semibold self-start sm:self-auto shrink-0 shadow-xs"
            >
              <ArrowLeftRight className="size-3.5 text-primary" />
              Compare Another Brand
            </Button>
          )}
        </div>

        {/* Loading published brands state */}
        {isLoadingBrands && (
          <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="size-3.5 animate-spin text-primary" />
            <span>Loading published brand sizing charts...</span>
          </div>
        )}

        {/* Loading error state */}
        {!isLoadingBrands && loadingError && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center">
            <AlertCircle className="size-5 text-destructive mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-destructive">{loadingError}</p>
            <Button onClick={loadBrands} variant="outline" size="sm" className="mt-3 gap-1.5 text-xs">
              <RefreshCw className="size-3" />
              Retry Loading Brands
            </Button>
          </div>
        )}

        {/* Dropdowns Interface */}
        {!isLoadingBrands && !loadingError && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Dropdown: Select Brand */}
            <div className="space-y-1.5">
              <label
                htmlFor="brand-select-dropdown"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>Select Brand</span>
                {selectedBrandId && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Step 1 of 2
                  </span>
                )}
              </label>
              <select
                id="brand-select-dropdown"
                value={selectedBrandId || ""}
                onChange={(e) => onBrandSelect(e.target.value || null)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="">-- Choose a brand --</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.slug}>
                    {brand.name} {brand.is_official || brand.sizingChart?.is_official ? "(Official Chart)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Second Dropdown: Dynamic Selector conditioned on active brand format */}
            {selectedBrandId && activeBrandDetail ? (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                {/* 1. Glamnetic (shape_range): Select Nail Shape / Collection */}
                {chartFormat === "shape_range" && chart?.shape_ranges && chart.shape_ranges.length > 0 && (
                  <>
                    <label htmlFor="glamnetic-shape-dropdown" className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Select Nail Shape / Collection</span>
                      <span className="text-[11px] font-normal text-primary">Step 2 of 2</span>
                    </label>
                    <select
                      id="glamnetic-shape-dropdown"
                      value={selectedShape}
                      onChange={(e) => setSelectedShape(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {chart.shape_ranges.map((sr) => {
                        const dimInfo = sr.length_min_mm && sr.length_max_mm
                          ? ` (${sr.length_min_mm}–${sr.length_max_mm}mm L)`
                          : "";
                        return (
                          <option key={sr.shape} value={sr.shape}>
                            {sr.shape}{dimInfo}
                          </option>
                        );
                      })}
                    </select>
                  </>
                )}

                {/* 2. Joyee (numbered_size): Select Numbered Size */}
                {chartFormat === "numbered_size" && chart?.numbered_sizes && (
                  <>
                    <label htmlFor="joyee-size-dropdown" className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Select Numbered Size</span>
                      <span className="text-[11px] font-normal text-amber-700 dark:text-amber-400">Step 2 of 2</span>
                    </label>
                    <select
                      id="joyee-size-dropdown"
                      value={selectedNumberedSize}
                      onChange={(e) => setSelectedNumberedSize(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="all">All Sizes (#0–#9 Overview)</option>
                      {chart.numbered_sizes.map((ns) => {
                        const widthLabel = typeof ns.width_mm === "number"
                          ? `${ns.width_mm}mm`
                          : ns.min_width_mm && ns.max_width_mm
                          ? `${ns.min_width_mm}–${ns.max_width_mm}mm`
                          : "spec";
                        return (
                          <option key={ns.size} value={String(ns.size)}>
                            Size #{ns.size} ({widthLabel}
                            {ns.typical_finger ? ` · ${ns.typical_finger}` : ""})
                          </option>
                        );
                      })}
                    </select>
                  </>
                )}

                {/* 3. PRESSE (preset_set): Select Preset Size */}
                {(chartFormat === "preset_set" || chartFormat === "per_size" || chartFormat === "per_size_fingers") && chart?.sizes && (
                  <>
                    <label htmlFor="presse-preset-dropdown" className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Select Preset Size</span>
                      <span className="text-[11px] font-normal text-lavender-deep">Step 2 of 2</span>
                    </label>
                    <select
                      id="presse-preset-dropdown"
                      value={selectedPreset}
                      onChange={(e) => setSelectedPreset(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="recommended">
                        Recommended Preset ({presetMatch?.recommendedSet ? `Set ${presetMatch.recommendedSet}` : "Auto-matched"})
                      </option>
                      {Object.keys(chart.sizes).map((sz) => (
                        <option key={sz} value={sz}>
                          Preset Set: {sz}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {/* 4. The Nailest (length_only_numbered): Select Nail Shape */}
                {chartFormat === "length_only_numbered" && lengthOnlyMatch && (
                  <>
                    <label htmlFor="nailest-shape-dropdown" className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Select Nail Shape</span>
                      <span className="text-[11px] font-normal text-purple-700 dark:text-purple-400">Step 2 of 2</span>
                    </label>
                    <select
                      id="nailest-shape-dropdown"
                      value={selectedShape || lengthOnlyMatch.selectedShape}
                      onChange={(e) => setSelectedShape(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {lengthOnlyMatch.availableShapes.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {/* 5. Width Ranges fallback */}
                {chartFormat === "width_ranges" && chart?.ranges && (
                  <>
                    <label htmlFor="width-range-fallback" className="text-xs font-semibold text-foreground">
                      Size Bracket
                    </label>
                    <select
                      id="width-range-fallback"
                      disabled
                      className="w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm font-medium text-muted-foreground shadow-xs cursor-default"
                    >
                      <option>All Size Range Brackets ({chart.ranges.length} Brackets)</option>
                    </select>
                  </>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex flex-col justify-end">
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground text-center">
                  Select a brand to view shape or preset options
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* EMPTY STATE: WHEN NO BRAND IS SELECTED                               */}
      {/* ==================================================================== */}
      {!selectedBrandId && !isLoadingBrands && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 sm:p-10 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <Ruler className="size-6" />
          </div>
          <h4 className="font-display text-lg font-bold text-foreground">
            No Brand Selected
          </h4>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Choose a press-on nail brand from the dropdown above to view official size matching, tip dimensions, and fit analysis tailored to your measurements.
          </p>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION D — BRAND SIZING RESULT PANEL                                */}
      {/* ==================================================================== */}
      {selectedBrandId && (
        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-6">
          {/* Brand Result Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/70">
            <div className="flex items-center gap-3.5">
              {activeBrandDetail?.logo_url ? (
                <img
                  src={activeBrandDetail.logo_url}
                  alt={`${activeBrandDetail.name} logo`}
                  className="size-13 rounded-2xl object-contain border border-border bg-background p-1.5 shadow-xs shrink-0"
                />
              ) : (
                <div className="flex size-13 items-center justify-center rounded-2xl bg-primary/10 border border-border font-bold text-primary text-xl shrink-0">
                  {activeBrandDetail?.name.charAt(0) || "B"}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                    {activeBrandDetail?.name || "Brand"} Sizing Result
                  </h3>
                  {(activeBrandDetail?.is_official || chart?.is_official) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="size-3 text-emerald-600" />
                      Official Brand Chart
                    </span>
                  )}
                  {chartFormat && (
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getFormatBadge(chartFormat).color}`}>
                      {getFormatBadge(chartFormat).label}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>Chart: {chart?.chartName || "Standard Guide"}</span>
                  <span>•</span>
                  <span>Unit: Millimeters (mm)</span>
                  {selectedShape && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-foreground">Shape: {selectedShape}</span>
                    </>
                  )}
                  {selectedPreset && selectedPreset !== "recommended" && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-foreground">Preset: {selectedPreset}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onBrandSelect(null)}
              className="gap-1.5 text-xs font-semibold shrink-0 shadow-xs"
            >
              <ArrowLeftRight className="size-3.5 text-primary" />
              Compare Another Brand
            </Button>
          </div>

          {/* Loading Detail State */}
          {isLoadingDetail && (
            <div className="py-12 text-center">
              <RefreshCw className="size-6 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Calculating brand compatibility...</p>
            </div>
          )}

          {/* No Chart Available / Graceful Handling */}
          {!isLoadingDetail && !chart && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-3">
              <AlertCircle className="size-6 text-amber-600 mx-auto" />
              <h4 className="font-display text-lg font-bold text-foreground">
                No Published Sizing Chart Available
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No reliable brand-specific sizing chart is currently published for this studio. You can use your universal calibrated millimeter measurements to check fit manually with the brand.
              </p>
              <Button onClick={() => onBrandSelect(null)} variant="outline" size="sm" className="mt-2">
                Choose a Different Brand
              </Button>
            </div>
          )}

          {/* ================================================================= */}
          {/* FORMAT A: PRESET SIZE SET (e.g. PRESSE: XS, S, M, L)              */}
          {/* ================================================================= */}
          {!isLoadingDetail && chart && presetMatch && activePresetComparison && (
            <div className="space-y-6">
              {/* Highlight Recommendation Card */}
              <div className="rounded-2xl border border-lavender-deep/30 bg-lavender/25 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-lavender-deep">
                    {activePresetComparison.isAutoRecommended ? "Recommended Preset Fit" : "Selected Preset Fit"}
                  </span>
                  <h4 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-foreground">
                    Size Set: {activePresetComparison.setKey}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activePresetComparison.isAutoRecommended
                      ? `Closest match across your finger widths (Total deviation: ±${activePresetComparison.totalDiff.toFixed(1)} mm).`
                      : `Comparison against Preset Set ${activePresetComparison.setKey} (Total deviation: ±${activePresetComparison.totalDiff.toFixed(1)} mm).`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-muted-foreground mr-1">Available Sets:</span>
                  {presetMatch.availableSets.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedPreset(s)}
                      className={`inline-flex size-8 items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        s === activePresetComparison.setKey
                          ? "bg-lavender-deep text-white shadow-soft ring-2 ring-lavender-deep/40"
                          : "bg-background text-foreground border border-border hover:border-lavender-deep/50"
                      }`}
                      title={`Switch to Preset Set ${s}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Finger-wise Comparison Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span className="font-semibold text-foreground">
                    Finger-Wise Comparison (Preset {activePresetComparison.setKey})
                  </span>
                  <span>Unit: mm</span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-3 px-4">Finger</th>
                        <th className="py-3 px-3">Your Measured Width</th>
                        <th className="py-3 px-3">Preset {activePresetComparison.setKey} Spec</th>
                        <th className="py-3 px-3">Fit Deviation</th>
                        <th className="py-3 px-4">Fit Analysis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {activePresetComparison.items.map((c) => (
                        <tr key={c.finger} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold font-sans text-foreground">
                            {c.finger}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-foreground">
                            {c.measuredWidthMm !== undefined ? `${c.measuredWidthMm.toFixed(2)} mm` : "—"}
                          </td>
                          <td className="py-3.5 px-3 text-muted-foreground">
                            {c.presetWidthMm !== undefined ? `${c.presetWidthMm.toFixed(1)} mm` : "—"}
                          </td>
                          <td className="py-3.5 px-3">
                            {c.diffMm !== undefined ? (
                              <span
                                className={`font-semibold ${
                                  c.isExact
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : Math.abs(c.diffMm) <= 1.0
                                    ? "text-foreground"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {c.diffMm > 0 ? `+${c.diffMm.toFixed(1)} mm` : `${c.diffMm.toFixed(1)} mm`}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-xs">
                            {c.isExact ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                <CheckCircle2 className="size-3.5" /> Exact Fit (≤0.2mm)
                              </span>
                            ) : c.diffMm !== undefined && c.diffMm > 0 ? (
                              <span className="text-muted-foreground">
                                +{c.diffMm.toFixed(1)}mm roomier
                              </span>
                            ) : c.diffMm !== undefined ? (
                              <span className="text-muted-foreground">
                                {Math.abs(c.diffMm).toFixed(1)}mm snugger
                              </span>
                            ) : (
                              "Pending Measurement"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Integrity & Recommendation Disclaimer Box */}
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-300">
                <Info className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong>Important Sizing Guidance:</strong> {presetMatch.disclaimer} If your finger measurements span multiple preset sets, consider ordering individual replacement sizes or sizing up for safe filing.
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* FORMAT B: NUMBERED SIZES (e.g. Joyee: #0 to #9)                  */}
          {/* ================================================================= */}
          {!isLoadingDetail && chart && numberedMatch && (
            <div className="space-y-6">
              {/* Highlight Recommendation Card */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 sm:p-6 shadow-xs space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Custom Numbered Tip Recommendation
                </span>
                <h4 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                  Your Matched Sizes: {numberedMatch.fingerMatches.map((f) => `#${f.size}`).join(" • ")}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Individual tip numbers matched by millimeter width. Note: Brand numbering preserves Size 0 as smallest (pinky) and Size 9 as largest (thumb).
                </p>
              </div>

              {/* Finger-wise Numbered Match Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span className="font-semibold text-foreground">
                    Finger-to-Tip Size Mapping {selectedNumberedSize !== "all" ? `(Filtered: Size #${selectedNumberedSize})` : ""}
                  </span>
                  <span>Unit: mm</span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-3 px-4">Finger</th>
                        <th className="py-3 px-3">Your Measured Width</th>
                        <th className="py-3 px-3">Matched Size #</th>
                        <th className="py-3 px-3">Tip Width Spec</th>
                        <th className="py-3 px-3">Typical Finger</th>
                        <th className="py-3 px-4">Match Analysis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {displayedNumberedMatches.map((m) => (
                        <tr key={m.finger} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold font-sans text-foreground">
                            {m.finger}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-foreground">
                            {m.measuredWidthMm !== undefined ? `${m.measuredWidthMm.toFixed(2)} mm` : "—"}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-secondary text-secondary-foreground text-xs font-bold font-sans">
                              #{m.size}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-foreground">
                            {m.matchedWidthDisplay}
                          </td>
                          <td className="py-3.5 px-3 font-sans text-xs text-muted-foreground">
                            {m.typicalFinger || "—"}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-xs">
                            {m.fitStatus === "exact" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                <CheckCircle2 className="size-3.5" /> Exact Width Match
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                                Approximate Match (diff: ±{m.diffMm.toFixed(1)}mm)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Numbered Sizing Integrity & Disclaimer Box */}
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-300">
                <Info className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong>Approximate Match Notice:</strong> {numberedMatch.disclaimer} Measurements with (~) or range spans (e.g. Size 8: 15–16 mm) reflect boutique handmade sizing.
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* FORMAT C: SHAPE-BASED RANGES (e.g. Glamnetic: 14 shapes)          */}
          {/* ================================================================= */}
          {!isLoadingDetail && chart && shapeMatch && (
            <div className="space-y-6">
              {/* Shape Silhouette Specifications Card */}
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                      Nail Silhouette Bounds
                    </span>
                    <h4 className="mt-1 font-display text-xl sm:text-2xl font-bold text-foreground">
                      Silhouette Shape: {shapeMatch.selectedShape}
                    </h4>
                  </div>
                </div>

                {/* Selected Shape Physical Specifications Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-blue-500/20 text-xs">
                  <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                    <span className="text-[11px] text-muted-foreground block">Silhouette Length Span</span>
                    <span className="font-mono font-bold text-foreground text-sm">{shapeMatch.lengthRangeDisplay}</span>
                  </div>
                  <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                    <span className="text-[11px] text-muted-foreground block">Silhouette Width Span</span>
                    <span className="font-mono font-bold text-foreground text-sm">{shapeMatch.widthRangeDisplay}</span>
                  </div>
                  <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                    <span className="text-[11px] text-muted-foreground block">Average Thickness</span>
                    <span className="font-mono font-bold text-foreground text-sm">{shapeMatch.thicknessDisplay}</span>
                  </div>
                </div>
              </div>

              {/* Finger Widths vs Shape Silhouette Span */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span className="font-semibold text-foreground">
                    Finger Widths vs {shapeMatch.selectedShape} Bounds
                  </span>
                  <span>Unit: mm</span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-3 px-4">Finger</th>
                        <th className="py-3 px-3">Your Measured Width</th>
                        <th className="py-3 px-3">Silhouette Width Range</th>
                        <th className="py-3 px-4">Silhouette Span Compatibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {shapeMatch.fingerComparisons.map((fc) => (
                        <tr key={fc.finger} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold font-sans text-foreground">
                            {fc.finger}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-foreground">
                            {fc.measuredWidthMm !== undefined ? `${fc.measuredWidthMm.toFixed(2)} mm` : "—"}
                          </td>
                          <td className="py-3.5 px-3 text-muted-foreground">
                            {shapeMatch.widthRangeDisplay}
                          </td>
                          <td className="py-3.5 px-4 font-sans text-xs">
                            {fc.isWithinRange ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                <CheckCircle2 className="size-3.5" /> Fits within silhouette width boundaries
                              </span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400 font-medium">
                                {fc.statusText}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Shape Range Integrity Callout */}
              <div className="flex items-start gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-blue-950 dark:text-blue-300">
                <Info className="size-4 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <strong>Silhouette Dimension Specifications:</strong> {shapeMatch.disclaimer} Measurements describe physical millimeter boundaries for each shape silhouette (from smallest to largest tip in the collection).
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* FORMAT D: WIDTH RANGES (Partner Studios)                          */}
          {/* ================================================================= */}
          {!isLoadingDetail && chart && widthRangeMatch && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Range Match Recommendation
                </span>
                <h4 className="font-display text-xl font-bold text-foreground">
                  Overall Fit: {widthRangeMatch.overallSetSize}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {widthRangeMatch.ruleExplanation}
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                      <th className="py-3 px-4">Finger</th>
                      <th className="py-3 px-3">Your Measured Width</th>
                      <th className="py-3 px-3">Brand Range Bracket</th>
                      <th className="py-3 px-3">Recommended Size</th>
                      <th className="py-3 px-4">Analysis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {widthRangeMatch.fingerFits.map((fit) => (
                      <tr key={fit.finger} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3.5 px-4 font-bold font-sans text-foreground">
                          {fit.finger}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-foreground">
                          {typeof fit.measuredWidthMm === "number" ? `${fit.measuredWidthMm.toFixed(2)} mm` : "—"}
                        </td>
                        <td className="py-3.5 px-3 text-muted-foreground">
                          {fit.chartRange ? `${fit.chartRange.minMm}–${fit.chartRange.maxMm} mm` : "—"}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground text-xs font-bold px-2 py-0.5 font-sans">
                            {fit.recommendedSize}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-sans text-xs text-muted-foreground">
                          {fit.explanation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* FORMAT E: LENGTH-ONLY NUMBERED (The Nailest)                      */}
          {/* ================================================================= */}
          {!isLoadingDetail && chart && lengthOnlyMatch && (
            <div className="space-y-6">
              {/* Shape Specifications & Alert Banner */}
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                      Shape Length Specification Guide
                    </span>
                    <h4 className="font-display text-xl font-bold text-foreground">
                      {lengthOnlyMatch.selectedShape} Tip Lengths (#0–#9)
                    </h4>
                  </div>
                </div>

                {/* Strict Width Absence Callout as required by prompt */}
                <div className="flex items-start gap-3 rounded-xl border border-purple-500/20 bg-background/80 p-3.5 text-xs text-foreground">
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
                  <div className="space-y-1">
                    <p className="font-semibold text-purple-900 dark:text-purple-200">
                      Length information is available, but width measurements are not provided by this brand.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Exact size matching is currently unavailable because this brand provides only nail tip lengths without width specifications. No size number or fit percentage can be reliably calculated from your natural nail bed widths.
                    </p>
                  </div>
                </div>
              </div>

              {/* Corresponding #0–#9 Length Chart Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span className="font-semibold text-foreground">
                    Vertical Tip Lengths for {lengthOnlyMatch.selectedShape}
                  </span>
                  <span>Unit: mm (Cuticle base to tip)</span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-3 px-4">Size Number</th>
                        <th className="py-3 px-4">Vertical Length (mm)</th>
                        <th className="py-3 px-4">Width (mm)</th>
                        <th className="py-3 px-4">Matching Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {lengthOnlyMatch.shapeLengths.map((row) => (
                        <tr key={row.size} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold font-sans text-foreground">
                            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold text-xs">
                              {row.size}
                            </span>
                            {row.size === "#0" && (
                              <span className="ml-2 text-[10px] text-muted-foreground font-sans uppercase tracking-wider">
                                (Longest)
                              </span>
                            )}
                            {row.size === "#9" && (
                              <span className="ml-2 text-[10px] text-muted-foreground font-sans uppercase tracking-wider">
                                (Shortest)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-foreground">
                            {row.length_mm} mm
                          </td>
                          <td className="py-3.5 px-4 font-sans text-xs text-muted-foreground">
                            Not provided by brand
                          </td>
                          <td className="py-3.5 px-4 font-sans text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 text-muted-foreground/80">
                              <Info className="size-3.5" />
                              Width match unavailable
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Numbering Direction & Reference Note */}
              <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0 text-lavender-deep mt-0.5" />
                <div>
                  <strong className="text-foreground">Brand Numbering Convention:</strong> #0 is the longest nail tip ({lengthOnlyMatch.shapeLengths[0]?.length_mm ?? 23} mm) and #9 is the shortest nail tip ({lengthOnlyMatch.shapeLengths[lengthOnlyMatch.shapeLengths.length - 1]?.length_mm ?? 15} mm). Natural nail bed width matching is omitted to prevent incorrect sizing.
                </div>
              </div>
            </div>
          )}

          {/* Metadata Footer: Source URL, Verification & Compare Another Brand */}
          <div className="pt-4 border-t border-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 text-xs text-muted-foreground">
              {chart?.verification_status && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">Verification:</span>
                  <span className="capitalize">{chart.verification_status.replace("_", " ")}</span>
                </div>
              )}
              {chart?.source_url && (
                <div className="flex items-center gap-1.5">
                  <span>Source Guide:</span>
                  <a
                    href={chart.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline font-mono inline-flex items-center gap-1"
                  >
                    View Original Brand Chart <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
            </div>

            <Button
              onClick={() => onBrandSelect(null)}
              variant="outline"
              size="sm"
              className="gap-2 text-xs font-semibold shadow-xs"
            >
              <ArrowLeftRight className="size-3.5 text-primary" />
              Compare Another Brand
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
