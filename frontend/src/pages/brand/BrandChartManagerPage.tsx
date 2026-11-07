import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Save,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Plus,
  Trash2,
  Table,
  Layers,
  Globe,
  Lock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandPortalLayout } from "@/components/layout/BrandPortalLayout";
import {
  getCurrentBrandUser,
  getBrands,
  getBrandById,
  parseChartFromCsv,
} from "@/services/brandService";
import { authAdapter } from "@/services/authAdapter";
import {
  brandApiService,
  DbSizingChart,
  validateChartPayloadLocally,
  ChartValidationResult,
  RealBrandProfile,
} from "@/services/brandApiService";
import type {
  FingerWidthMap,
  NailWidthRange,
} from "@/types/brand";

const FINGER_KEYS: Array<{ key: keyof FingerWidthMap; label: string }> = [
  { key: "thumb", label: "Thumb" },
  { key: "index", label: "Index" },
  { key: "middle", label: "Middle" },
  { key: "ring", label: "Ring" },
  { key: "pinky", label: "Pinky" },
];

const DEFAULT_SIZES: Record<string, FingerWidthMap> = {
  XS: { thumb: 14, index: 11, middle: 12, ring: 10, pinky: 8 },
  S: { thumb: 15, index: 12, middle: 13, ring: 11, pinky: 8 },
  M: { thumb: 16, index: 12, middle: 14, ring: 11, pinky: 9 },
  L: { thumb: 18, index: 13, middle: 15, ring: 12, pinky: 10 },
};

const DEFAULT_RANGES: NailWidthRange[] = [
  { sizeLabel: "0", minMm: 17.5, maxMm: 19.5 },
  { sizeLabel: "1", minMm: 16.0, maxMm: 17.4 },
  { sizeLabel: "2", minMm: 15.0, maxMm: 15.9 },
  { sizeLabel: "3", minMm: 14.0, maxMm: 14.9 },
  { sizeLabel: "4", minMm: 13.0, maxMm: 13.9 },
  { sizeLabel: "5", minMm: 12.0, maxMm: 12.9 },
  { sizeLabel: "6", minMm: 11.0, maxMm: 11.9 },
  { sizeLabel: "7", minMm: 10.0, maxMm: 10.9 },
  { sizeLabel: "8", minMm: 9.0, maxMm: 9.9 },
  { sizeLabel: "9", minMm: 8.0, maxMm: 8.9 },
];

interface CsvPreviewState {
  format: "per_size" | "width_ranges";
  perSizeRows?: Array<{
    size: string;
    thumb: number;
    index: number;
    middle: number;
    ring: number;
    pinky: number;
  }>;
  rangeRows?: Array<{
    size: string;
    min: number;
    max: number;
  }>;
  errors: string[];
}

export function BrandChartManagerPage() {
  const isLive = authAdapter.isRemoteEnabled();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brand Profile State
  const [realBrand, setRealBrand] = useState<RealBrandProfile | null>(null);

  // Live Chart List State
  const [charts, setCharts] = useState<DbSizingChart[]>([]);
  const [activeChartId, setActiveChartId] = useState<string | null>(null);

  // Form State
  const [chartName, setChartName] = useState("Standard Nail Sizing");
  const [customNotes, setCustomNotes] = useState("");
  const [format, setFormat] = useState<"per_size" | "width_ranges">("per_size");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isPublic, setIsPublic] = useState(false);
  const [sizes, setSizes] = useState<Record<string, FingerWidthMap>>(DEFAULT_SIZES);
  const [ranges, setRanges] = useState<NailWidthRange[]>(DEFAULT_RANGES);

  const [newSizeKey, setNewSizeKey] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [validationModal, setValidationModal] = useState<ChartValidationResult | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewState | null>(null);

  // Load live charts or demo brand chart
  useEffect(() => {
    let mounted = true;
    async function init() {
      if (isLive) {
        try {
          const [b, list] = await Promise.all([
            brandApiService.getMyBrand(),
            brandApiService.getMyCharts(),
          ]);
          if (mounted) {
            setRealBrand(b);
            setCharts(list);
            if (list.length > 0 && !location.search.includes("action=new")) {
              loadChartIntoEditor(list[0]);
            } else {
              handleCreateNewChart();
            }
          }
        } catch (err) {
          console.error("Failed to fetch charts:", err);
        }
      } else {
        const currentUser = getCurrentBrandUser();
        const demoBrands = getBrands();
        const b = (currentUser?.brandId ? getBrandById(currentUser.brandId) : null) || demoBrands[0];
        if (b) {
          setChartName(b.sizingChart.chartName);
          setCustomNotes(b.sizingChart.customNotes || "");
          setFormat(b.sizingChart.format === "width_ranges" ? "width_ranges" : "per_size");
          setStatus("published");
          setIsPublic(b.chartVisibility !== "hidden");
          if (b.sizingChart.sizes && Object.keys(b.sizingChart.sizes).length > 0) {
            setSizes(b.sizingChart.sizes);
          }
          if (b.sizingChart.ranges && b.sizingChart.ranges.length > 0) {
            setRanges(b.sizingChart.ranges);
          }
        }
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, [isLive, location.search]);

  const loadChartIntoEditor = (c: DbSizingChart) => {
    setActiveChartId(c.id);
    setChartName(c.chart_name);
    setCustomNotes(c.custom_notes || "");
    setFormat(c.format);
    setStatus(c.status);
    setIsPublic(c.is_public);

    if (c.format === "width_ranges") {
      const parsedRanges: NailWidthRange[] = (c.sizing_chart_entries || []).map((e) => ({
        sizeLabel: e.size_label,
        minMm: e.min_width_mm || 0,
        maxMm: e.max_width_mm || 0,
      }));
      setRanges(parsedRanges.length > 0 ? parsedRanges : DEFAULT_RANGES);
    } else {
      const parsedSizes: Record<string, FingerWidthMap> = {};
      (c.sizing_chart_entries || []).forEach((e) => {
        parsedSizes[e.size_label] = {
          thumb: e.thumb_width_mm || 0,
          index: e.index_width_mm || 0,
          middle: e.middle_width_mm || 0,
          ring: e.ring_width_mm || 0,
          pinky: e.pinky_width_mm || 0,
        };
      });
      setSizes(Object.keys(parsedSizes).length > 0 ? parsedSizes : DEFAULT_SIZES);
    }
    setStatusMessage(null);
  };

  const handleCreateNewChart = () => {
    setActiveChartId(null);
    setChartName("New Sizing Chart");
    setCustomNotes("");
    setFormat("per_size");
    setStatus("draft");
    setIsPublic(false);
    setSizes(DEFAULT_SIZES);
    setRanges(DEFAULT_RANGES);
    setStatusMessage({
      type: "success",
      text: "Created new blank draft. Configure specifications and click 'Save as Draft' or 'Publish'.",
    });
  };

  // Live Range Validation (Min <= Max, Overlaps, Gaps)
  const rangeValidation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    ranges.forEach((r) => {
      if (r.minMm <= 0 || r.maxMm <= 0) {
        errors.push(`Size ${r.sizeLabel || "Untitled"}: Millimeter values must be positive.`);
      }
      if (r.minMm > r.maxMm) {
        errors.push(`Size ${r.sizeLabel || "Untitled"}: Min width (${r.minMm} mm) exceeds Max width (${r.maxMm} mm).`);
      }
    });

    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const a = ranges[i];
        const b = ranges[j];
        if (Math.max(a.minMm, b.minMm) <= Math.min(a.maxMm, b.maxMm)) {
          warnings.push(
            `Overlap detected between Size ${a.sizeLabel} (${a.minMm}–${a.maxMm} mm) and Size ${b.sizeLabel} (${b.minMm}–${b.maxMm} mm).`
          );
        }
      }
    }

    const sorted = [...ranges].sort((a, b) => a.minMm - b.minMm);
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      if (curr.maxMm < next.minMm - 0.1) {
        warnings.push(
          `Gap detected between Size ${curr.sizeLabel} (max ${curr.maxMm} mm) and Size ${next.sizeLabel} (min ${next.minMm} mm).`
        );
      }
    }

    return { errors, warnings };
  }, [ranges]);

  const handleWidthChange = (
    sizeKey: string,
    finger: keyof FingerWidthMap,
    valStr: string
  ) => {
    const val = parseFloat(valStr) || 0;
    setSizes((prev) => ({
      ...prev,
      [sizeKey]: {
        ...prev[sizeKey],
        [finger]: val,
      },
    }));
  };

  const handleAddSizeRow = () => {
    const trimmed = newSizeKey.trim().toUpperCase();
    if (!trimmed) return;
    if (sizes[trimmed]) {
      setStatusMessage({
        type: "error",
        text: `Size code "${trimmed}" already exists in chart table.`,
      });
      return;
    }
    setSizes((prev) => ({
      ...prev,
      [trimmed]: { thumb: 15, index: 12, middle: 13, ring: 11, pinky: 8 },
    }));
    setNewSizeKey("");
    setStatusMessage({
      type: "success",
      text: `Added size "${trimmed}" row to table.`,
    });
  };

  const handleRemoveSizeRow = (sz: string) => {
    if (Object.keys(sizes).length <= 1) {
      setStatusMessage({
        type: "error",
        text: "Chart must retain at least one size row.",
      });
      return;
    }
    const next = { ...sizes };
    delete next[sz];
    setSizes(next);
  };

  const handleRangeChange = (
    index: number,
    field: keyof NailWidthRange,
    valStr: string
  ) => {
    setRanges((prev) => {
      const copy = [...prev];
      if (field === "sizeLabel") {
        copy[index] = { ...copy[index], sizeLabel: valStr };
      } else {
        const val = parseFloat(valStr) || 0;
        copy[index] = { ...copy[index], [field]: val };
      }
      return copy;
    });
  };

  const handleAddRange = () => {
    const nextLabel = String(ranges.length);
    const lastRange = ranges[ranges.length - 1];
    const newMin = lastRange ? Math.max(0, parseFloat((lastRange.minMm - 1.0).toFixed(1))) : 8.0;
    const newMax = lastRange ? Math.max(0, parseFloat((lastRange.minMm - 0.1).toFixed(1))) : 8.9;
    setRanges((prev) => [...prev, { sizeLabel: nextLabel, minMm: newMin, maxMm: newMax }]);
  };

  const handleRemoveRange = (index: number) => {
    if (ranges.length <= 1) {
      setStatusMessage({
        type: "error",
        text: "Format B chart must retain at least one range tier.",
      });
      return;
    }
    setRanges((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSortRanges = (direction: "asc" | "desc") => {
    setRanges((prev) =>
      [...prev].sort((a, b) =>
        direction === "asc" ? a.minMm - b.minMm : b.minMm - a.minMm
      )
    );
  };

  const buildCurrentPayload = (targetStatus: "draft" | "published", targetPublic: boolean) => {
    return {
      chart_name: chartName,
      format,
      status: targetStatus,
      is_public: targetPublic,
      custom_notes: customNotes,
      source_type: "manual" as const,
      per_size_entries:
        format === "per_size"
          ? Object.entries(sizes).map(([sz, dims]) => ({
              size_label: sz,
              thumb_width_mm: dims.thumb,
              index_width_mm: dims.index,
              middle_width_mm: dims.middle,
              ring_width_mm: dims.ring,
              pinky_width_mm: dims.pinky,
            }))
          : undefined,
      width_range_entries:
        format === "width_ranges"
          ? ranges.map((r) => ({
              size_label: r.sizeLabel,
              min_width_mm: r.minMm,
              max_width_mm: r.maxMm,
            }))
          : undefined,
    };
  };

  const handleSaveDraft = async () => {
    setStatusMessage(null);
    const payload = buildCurrentPayload("draft", false);
    const res = await brandApiService.saveChart(payload, activeChartId || undefined);

    if (res.success) {
      setStatus("draft");
      setIsPublic(false);
      setStatusMessage({
        type: "success",
        text: "Sizing chart saved as private draft in PostgreSQL.",
      });
      if (isLive) {
        const list = await brandApiService.getMyCharts();
        setCharts(list);
      }
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Failed to save draft.",
      });
    }
  };

  const handlePublish = async () => {
    setStatusMessage(null);
    const payload = buildCurrentPayload("published", true);
    const val = validateChartPayloadLocally(payload);

    if (!val.valid) {
      setValidationModal(val);
      return;
    }

    const res = await brandApiService.saveChart(payload, activeChartId || undefined);
    if (res.success) {
      setStatus("published");
      setIsPublic(true);
      setStatusMessage({
        type: "success",
        text: "Sizing chart published! Customers will now match against this chart during optical coin sizing scans.",
      });
      if (isLive) {
        const list = await brandApiService.getMyCharts();
        setCharts(list);
      }
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Failed to publish sizing chart.",
      });
    }
  };

  const handleUnpublish = async () => {
    setStatusMessage(null);
    const payload = buildCurrentPayload("draft", false);
    const res = await brandApiService.saveChart(payload, activeChartId || undefined);

    if (res.success) {
      setStatus("draft");
      setIsPublic(false);
      setStatusMessage({
        type: "success",
        text: "Sizing chart unpublished. Converted back to private studio draft.",
      });
      if (isLive) {
        const list = await brandApiService.getMyCharts();
        setCharts(list);
      }
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Failed to unpublish chart.",
      });
    }
  };

  const handleDelete = async () => {
    if (!activeChartId) {
      handleResetToDefault();
      return;
    }
    if (!confirm("Are you sure you want to delete this sizing chart? This action cannot be undone.")) {
      return;
    }

    const res = await brandApiService.deleteChart(activeChartId);
    if (res.success) {
      setStatusMessage({
        type: "success",
        text: "Sizing chart deleted.",
      });
      if (isLive) {
        const list = await brandApiService.getMyCharts();
        setCharts(list);
        if (list.length > 0) {
          loadChartIntoEditor(list[0]);
        } else {
          handleCreateNewChart();
        }
      }
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Failed to delete sizing chart.",
      });
    }
  };

  const handleResetToDefault = () => {
    if (format === "per_size") {
      setSizes(DEFAULT_SIZES);
      setChartName("Default Press-On Calibration");
      setStatusMessage({
        type: "success",
        text: "Reset Format A table to standard factory defaults.",
      });
    } else {
      setRanges(DEFAULT_RANGES);
      setChartName("Default Width Range Calibration");
      setStatusMessage({
        type: "success",
        text: "Reset Format B ranges to standard manufacturer template.",
      });
    }
  };

  /**
   * In-Memory CSV/Sheet Parsing with Structured Preview
   * Never uploads raw file; reads text into memory and parses rows.
   */
  const processCsvFile = (file: File) => {
    setStatusMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setStatusMessage({ type: "error", text: "CSV file is empty or missing data rows." });
        return;
      }

      const header = lines[0].toLowerCase().split(",").map((c) => c.trim());

      // Check if Format B: contains "min" and "max"
      const isFormatB = header.some((h) => h.includes("min")) && header.some((h) => h.includes("max"));

      if (isFormatB) {
        const sizeIdx = header.findIndex((h) => h.includes("size") || h.includes("label"));
        const minIdx = header.findIndex((h) => h.includes("min"));
        const maxIdx = header.findIndex((h) => h.includes("max"));

        const rangeRows: Array<{ size: string; min: number; max: number }> = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(",").map((p) => p.trim());
          const size = parts[sizeIdx] || `Tier ${i}`;
          const min = parseFloat(parts[minIdx]);
          const max = parseFloat(parts[maxIdx]);

          if (isNaN(min) || isNaN(max)) {
            errors.push(`Row ${i} (${size}): Invalid non-numeric millimeters.`);
          } else if (min > max) {
            errors.push(`Row ${i} (${size}): Min (${min} mm) > Max (${max} mm).`);
          } else {
            rangeRows.push({ size, min, max });
          }
        }

        setCsvPreview({ format: "width_ranges", rangeRows, errors });
      } else {
        // Format A parser
        const res = parseChartFromCsv(text);
        if (res.success && res.sizes) {
          const rows = Object.entries(res.sizes).map(([sz, d]) => ({
            size: sz,
            thumb: d.thumb,
            index: d.index,
            middle: d.middle,
            ring: d.ring,
            pinky: d.pinky,
          }));
          setCsvPreview({ format: "per_size", perSizeRows: rows, errors: [] });
        } else {
          setStatusMessage({ type: "error", text: res.error || "Failed to parse CSV columns." });
        }
      }
    };
    reader.readAsText(file);
  };

  const applyCsvPreview = () => {
    if (!csvPreview) return;
    if (csvPreview.format === "width_ranges" && csvPreview.rangeRows) {
      setRanges(csvPreview.rangeRows.map((r) => ({ sizeLabel: r.size, minMm: r.min, maxMm: r.max })));
      setFormat("width_ranges");
      setStatusMessage({
        type: "success",
        text: `Imported ${csvPreview.rangeRows.length} width ranges into Format B. Save draft or publish to persist.`,
      });
    } else if (csvPreview.format === "per_size" && csvPreview.perSizeRows) {
      const newSizes: Record<string, FingerWidthMap> = {};
      csvPreview.perSizeRows.forEach((r) => {
        newSizes[r.size] = {
          thumb: r.thumb,
          index: r.index,
          middle: r.middle,
          ring: r.ring,
          pinky: r.pinky,
        };
      });
      setSizes(newSizes);
      setFormat("per_size");
      setStatusMessage({
        type: "success",
        text: `Imported ${csvPreview.perSizeRows.length} sizes into Format A. Save draft or publish to persist.`,
      });
    }
    setCsvPreview(null);
  };

  return (
    <BrandPortalLayout
      brandName={realBrand?.name}
      contactName={realBrand?.contact_person || undefined}
      status={realBrand?.status || "pending_review"}
      brandSlug={realBrand?.slug}
    >
      <div className="space-y-6">
        {/* Status Message */}
        {statusMessage && (
          <div
            className={`flex items-center gap-3 rounded-xl p-4 text-xs sm:text-sm border ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : "bg-destructive/10 border-destructive/20 text-destructive"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="size-5 shrink-0" />
            ) : (
              <AlertCircle className="size-5 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Action Header: Create Chart + Import CSV Buttons */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Sizing Chart Calibrations
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage custom size definitions for automated AI customer recommendations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs gap-1.5"
            >
              <UploadCloud className="size-3.5" />
              Import CSV / Sheet
            </Button>

            <Button
              size="sm"
              onClick={handleCreateNewChart}
              className="text-xs gap-1.5 font-bold"
            >
              <Plus className="size-3.5" />
              Create Sizing Chart
            </Button>
          </div>
        </div>

        {/* Configured Charts List Switcher */}
        {charts.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider mb-2">
              Studio Sizing Charts ({charts.length})
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {charts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadChartIntoEditor(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                    activeChartId === c.id
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/40 text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <Table className="size-3.5 opacity-70" />
                  <span>{c.chart_name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono uppercase font-bold ${
                      c.status === "published"
                        ? activeChartId === c.id
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : activeChartId === c.id
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {c.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Supported Sizing Formats Explanation Card */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            onClick={() => setFormat("per_size")}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              format === "per_size"
                ? "border-primary bg-primary/5 shadow-xs"
                : "border-border bg-card hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between pb-1.5">
              <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <Table className="size-3.5 text-primary" />
                Format A: Per-Size Fingers
              </span>
              {format === "per_size" && (
                <span className="text-[9px] font-bold bg-primary text-primary-foreground px-2 py-0.2 rounded-full">
                  Selected
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Standard pre-set nail sets. Each size (XS, S, M, L) maps to individual millimeter widths for <strong>Thumb, Index, Middle, Ring, and Pinky</strong>.
            </p>
          </div>

          <div
            onClick={() => setFormat("width_ranges")}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
              format === "width_ranges"
                ? "border-primary bg-primary/5 shadow-xs"
                : "border-border bg-card hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between pb-1.5">
              <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                Format B: Width Ranges
              </span>
              {format === "width_ranges" && (
                <span className="text-[9px] font-bold bg-primary text-primary-foreground px-2 py-0.2 rounded-full">
                  Selected
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Full-cover tip boxes. Press-on tip labels (0–9) map to <strong>minimum and maximum natural nail width spans</strong> in millimeters.
            </p>
          </div>
        </div>

        {/* Hidden File Input for in-memory CSV/Sheet parse */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processCsvFile(file);
          }}
        />

        {/* Chart Details & Metadata */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="text-base font-bold text-foreground">
              {activeChartId ? `Editing: ${chartName}` : "Create New Sizing Chart"}
            </h3>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                  status === "published"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                }`}
              >
                {status}
              </span>
              {isPublic ? (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Globe className="size-3" /> Public
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Lock className="size-3" /> Private
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Chart Name
              </label>
              <input
                type="text"
                value={chartName}
                onChange={(e) => setChartName(e.target.value)}
                placeholder="e.g. Standard Handcrafted Press-On Fit 2026"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Unit of Measure
              </label>
              <input
                type="text"
                value="Millimeters (mm) — Precision Coin-Calibrated Standard"
                disabled
                className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-xs text-muted-foreground outline-none cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Brand Fit Notes & Recommendations
              </label>
              <textarea
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Advise customers if sets run slightly wide, or tips for flat/curved nail beds..."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Format A Table Editor */}
        {format === "per_size" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  Format A Table: Individual Finger Widths (mm)
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Each size code specifies exact millimeter widths for all 5 fingers.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToDefault}
                className="text-xs h-7 gap-1"
              >
                <RotateCcw className="size-3" />
                Defaults
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-sans font-semibold text-muted-foreground uppercase text-[10px]">
                    <th className="py-2.5 px-3">Size Code</th>
                    {FINGER_KEYS.map((f) => (
                      <th key={f.key} className="py-2.5 px-3">
                        {f.label} (mm)
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right font-sans">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {Object.entries(sizes).map(([sz, dims]) => (
                    <tr key={sz}>
                      <td className="py-2 px-3 font-bold font-sans text-foreground">
                        <span className="inline-flex size-7 items-center justify-center rounded-lg bg-secondary text-secondary-foreground text-xs font-bold">
                          {sz}
                        </span>
                      </td>
                      {FINGER_KEYS.map((f) => (
                        <td key={f.key} className="py-2 px-3">
                          <input
                            type="number"
                            step="0.5"
                            min="4"
                            max="35"
                            value={dims[f.key]}
                            onChange={(e) => handleWidthChange(sz, f.key, e.target.value)}
                            className="w-18 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSizeRow(sz)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Remove row"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newSizeKey}
                onChange={(e) => setNewSizeKey(e.target.value)}
                placeholder="New Size (e.g. XL, Custom 1)"
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary w-44"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddSizeRow}
                className="h-8 text-xs font-semibold gap-1"
              >
                <Plus className="size-3.5" />
                Add Size
              </Button>
            </div>
          </div>
        )}

        {/* Format B Table Editor */}
        {format === "width_ranges" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  Format B Table: Width Ranges (mm)
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Map each press-on tip label to the customer natural nail width span.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSortRanges("asc")}
                  className="text-xs h-7"
                >
                  Sort
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetToDefault}
                  className="text-xs h-7 gap-1"
                >
                  <RotateCcw className="size-3" />
                  Defaults
                </Button>
              </div>
            </div>

            {/* Validation warnings */}
            {rangeValidation.errors.length > 0 && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
                <strong>Validation Errors:</strong>
                <ul className="list-disc pl-5">
                  {rangeValidation.errors.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {rangeValidation.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <strong>Continuity Warnings:</strong>
                <ul className="list-disc pl-5">
                  {rangeValidation.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-border bg-muted/40 font-sans font-semibold text-muted-foreground uppercase text-[10px]">
                    <th className="py-2.5 px-3">Size Label</th>
                    <th className="py-2.5 px-3">Min Width (mm)</th>
                    <th className="py-2.5 px-3">Max Width (mm)</th>
                    <th className="py-2.5 px-3">Span</th>
                    <th className="py-2.5 px-3 text-right font-sans">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {ranges.map((r, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-sans">
                        <input
                          type="text"
                          value={r.sizeLabel}
                          onChange={(e) => handleRangeChange(idx, "sizeLabel", e.target.value)}
                          className="w-18 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold outline-none focus:border-primary"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.1"
                          min="4"
                          max="30"
                          value={r.minMm}
                          onChange={(e) => handleRangeChange(idx, "minMm", e.target.value)}
                          className="w-22 rounded-lg border border-border bg-background px-2.5 py-1 text-xs outline-none focus:border-primary"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.1"
                          min="4"
                          max="30"
                          value={r.maxMm}
                          onChange={(e) => handleRangeChange(idx, "maxMm", e.target.value)}
                          className="w-22 rounded-lg border border-border bg-background px-2.5 py-1 text-xs outline-none focus:border-primary"
                        />
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {(r.maxMm - r.minMm).toFixed(1)} mm
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRange(idx)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Remove row"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddRange}
                className="h-8 text-xs font-semibold gap-1"
              >
                <Plus className="size-3.5" />
                Add Range Tier
              </Button>
            </div>
          </div>
        )}

        {/* Action Controls Bar */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {activeChartId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:bg-destructive/10 text-xs gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Delete Chart
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              className="text-xs gap-1.5"
            >
              <Save className="size-3.5" />
              Save Draft
            </Button>

            {status === "published" ? (
              <Button
                variant="secondary"
                onClick={handleUnpublish}
                className="text-xs gap-1.5"
              >
                <Lock className="size-3.5" />
                Unpublish
              </Button>
            ) : (
              <Button
                onClick={handlePublish}
                className="text-xs gap-1.5 font-bold"
              >
                <Globe className="size-3.5" />
                Publish Sizing Chart
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Pre-Publish Validation Errors Modal */}
      {validationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2 text-destructive font-bold text-base">
                <AlertCircle className="size-5" />
                <span>Pre-Publish Validation Errors</span>
              </div>
              <button
                onClick={() => setValidationModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Please resolve the following calibration issues before publishing this chart to customers:
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
              <ul className="list-disc pl-5 space-y-1">
                {validationModal.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>

            {validationModal.warnings.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                <strong className="block font-bold">Warnings:</strong>
                <ul className="list-disc pl-5 space-y-0.5">
                  {validationModal.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button size="sm" onClick={() => setValidationModal(null)}>
                Got it, let me fix this
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* In-Memory CSV Import Preview Modal */}
      {csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2 font-bold text-base text-foreground">
                <FileSpreadsheet className="size-5 text-primary" />
                <span>CSV Import Preview (In-Memory)</span>
              </div>
              <button
                onClick={() => setCsvPreview(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Parsed format: <strong>{csvPreview.format === "width_ranges" ? "Format B (Width Ranges)" : "Format A (Per-Size Individual Fingers)"}</strong>.
              Review the structured rows below. File is parsed in-memory and not stored.
            </p>

            {csvPreview.errors.length > 0 && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                <strong className="block font-bold mb-1">Errors found:</strong>
                <ul className="list-disc pl-5 space-y-0.5">
                  {csvPreview.errors.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto border border-border/80 rounded-xl">
              {csvPreview.format === "width_ranges" && csvPreview.rangeRows ? (
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-muted/50 border-b border-border font-sans font-semibold">
                    <tr>
                      <th className="p-2.5">Size Label</th>
                      <th className="p-2.5">Min Width</th>
                      <th className="p-2.5">Max Width</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {csvPreview.rangeRows.map((r, i) => (
                      <tr key={i}>
                        <td className="p-2.5 font-bold font-sans">{r.size}</td>
                        <td className="p-2.5">{r.min} mm</td>
                        <td className="p-2.5">{r.max} mm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-muted/50 border-b border-border font-sans font-semibold">
                    <tr>
                      <th className="p-2.5">Size</th>
                      <th className="p-2.5">Thumb</th>
                      <th className="p-2.5">Index</th>
                      <th className="p-2.5">Middle</th>
                      <th className="p-2.5">Ring</th>
                      <th className="p-2.5">Pinky</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {csvPreview.perSizeRows?.map((r, i) => (
                      <tr key={i}>
                        <td className="p-2.5 font-bold font-sans">{r.size}</td>
                        <td className="p-2.5">{r.thumb} mm</td>
                        <td className="p-2.5">{r.index} mm</td>
                        <td className="p-2.5">{r.middle} mm</td>
                        <td className="p-2.5">{r.ring} mm</td>
                        <td className="p-2.5">{r.pinky} mm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-border/60">
              <Button variant="outline" size="sm" onClick={() => setCsvPreview(null)}>
                Discard
              </Button>
              <Button size="sm" onClick={applyCsvPreview} className="font-bold">
                Apply to Sizing Chart
              </Button>
            </div>
          </div>
        </div>
      )}
    </BrandPortalLayout>
  );
}

export default BrandChartManagerPage;
