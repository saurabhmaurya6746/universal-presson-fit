import { useState, useMemo, useRef } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bookmark,
  Check,
  Clipboard,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadSizeCardPdf, generateClipboardSizeText } from "@/services/sizeFinderService";
import { BrandFitComparison } from "@/components/brand/BrandFitComparison";
import type { NailSizeResult, FingerSize } from "@/types";

export interface SizeFinderResultsProps {
  results: NailSizeResult;
  onReset: () => void;
  selectedBrandId?: string | null;
  onBrandSelect?: (brandId: string | null) => void;
}

const DEFAULT_DOT_PALETTE = ["#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

function getNailSortKey(item: FingerSize, fallbackIdx: number): number {
  if (typeof item.nailIndex === "number") return item.nailIndex;
  const numMatch = item.finger.match(/nail\s*(\d+)/i);
  if (numMatch) return parseInt(numMatch[1], 10);
  const lower = item.finger.toLowerCase();
  if (lower.includes("thumb")) return 1;
  if (lower.includes("index")) return 2;
  if (lower.includes("middle")) return 3;
  if (lower.includes("ring")) return 4;
  if (lower.includes("pinky")) return 5;
  return 100 + fallbackIdx;
}

export function SizeFinderResults({
  results,
  onReset,
  selectedBrandId,
  onBrandSelect,
}: SizeFinderResultsProps) {
  const brandSectionRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saveNickname, setSaveNickname] = useState("");
  const [isSavedLocally, setIsSavedLocally] = useState(false);

  const detectedNails = useMemo(() => {
    const rawItems = results.measurements || results.leftHand || results.rightHand || [];
    return rawItems
      .map((item, idx) => ({ item, sortKey: getNailSortKey(item, idx), origIdx: idx }))
      .sort((a, b) => a.sortKey - b.sortKey || a.origIdx - b.origIdx)
      .map(({ item }) => item);
  }, [results]);

  const handleSaveLocally = () => {
    const name = saveNickname.trim() || "My Nail Size Profile";
    try {
      const existing = JSON.parse(
        localStorage.getItem("presson_fit_saved_profiles_demo") || "[]"
      );
      existing.unshift({
        id: "prof-" + Date.now(),
        nickname: name,
        savedAt: new Date().toLocaleDateString(),
        summary: results.summaryProfile,
        measurements: detectedNails.map((m, idx) => ({
          finger: m.finger,
          width_mm: m.width_mm,
          size: m.recommended_size || m.size,
          colorHex: m.colorHex || DEFAULT_DOT_PALETTE[idx % DEFAULT_DOT_PALETTE.length],
        })),
      });
      localStorage.setItem(
        "presson_fit_saved_profiles_demo",
        JSON.stringify(existing.slice(0, 10))
      );
      setIsSavedLocally(true);
      setTimeout(() => setIsSavedLocally(false), 3000);
    } catch {
      // storage fallback
    }
  };

  const handleCopy = async () => {
    const textToCopy = generateClipboardSizeText(results);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await downloadSizeCardPdf(results);
    } catch (err) {
      console.error("Failed to generate and download PDF size card:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCompareAnotherBrand = () => {
    onBrandSelect?.(null);
    brandSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const dropdown = document.getElementById("brand-select-dropdown") as HTMLSelectElement | null;
      dropdown?.focus();
    }, 350);
  };

  const hasValidationFailed = Boolean(results.validation && !results.validation.passed);
  const isUncalibrated = !results.coin_detected;

  return (
    <div className="space-y-8">
      {/* ==================================================================== */}
      {/* 1. AI DETECTION VIEW — FULL-WIDTH CARD + COMPACT NAIL MEASUREMENTS    */}
      {/* ==================================================================== */}
      <section className="rounded-3xl border border-lavender/70 bg-card p-5 sm:p-8 shadow-soft space-y-5">
        {/* Card Header with Status Badge & Top-Right Retake Button */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/50 px-3 py-1 text-xs font-semibold text-foreground border border-lavender/50">
                <Sparkles className="size-3.5 text-primary" />
                <span>{results.isDemo ? "Demo Results" : "Analysis Complete"}</span>
              </span>

              {results.coin_detected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-lavender/35 px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                  <span className="size-2 rounded-full bg-blue-600" />
                  <span>₹10 Coin Calibrated (27.0 mm)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="size-3 text-amber-600" />
                  <span>₹10 Coin Missing</span>
                </span>
              )}
            </div>

            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
              AI Detection View
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Detected nail contours, millimeter widths beside each marker, and ₹10 reference coin scale.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="gap-1.5 rounded-full px-4 text-xs font-semibold border-lavender-deep/35 bg-background hover:bg-lavender/20 shrink-0 shadow-xs"
          >
            <RotateCcw className="size-3.5 text-primary" />
            Retake
          </Button>
        </div>

        {/* Photo Quality / Coin Alerts */}
        {hasValidationFailed && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive space-y-1">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Photo Quality Alert</span>
            </div>
            <p className="font-semibold">
              {results.validation?.primaryError || "Photo does not meet precision measurement criteria."}
            </p>
          </div>
        )}

        {isUncalibrated && !hasValidationFailed && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
            <p className="leading-relaxed">
              {results.calibration_message ||
                "₹10 reference coin was not detected. Millimeter scale calibration requires a visible ₹10 coin beside your hand."}
            </p>
          </div>
        )}

        {/* Processed Hand Image with Overlays, Masks & ₹10 Reference Coin */}
        {results.processed_image_url ? (
          <div className="flex items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-blush/15 p-3 sm:p-5">
            <img
              src={results.processed_image_url}
              alt="AI Detection View with segmented nail boundaries, millimeter measurements, and ₹10 coin"
              className="max-h-[460px] w-auto max-w-full rounded-xl object-contain shadow-soft"
            />
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-lavender/70 bg-blush/10 p-6 text-center text-xs text-muted-foreground">
            Processed detection preview unavailable for this result.
          </div>
        )}

        {/* Compact Actual Nail Measurements Strip Below Image (Dynamic Count) */}
        <div className="space-y-3 pt-1">
          {detectedNails.length === 0 ? (
            <div className="rounded-2xl border border-lavender/50 bg-blush/15 p-4 text-center text-xs text-muted-foreground">
              No nail boundaries detected in this photo. Click <strong>Retake</strong> above to capture a clearer overhead hand photo.
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              {detectedNails.map((nail, idx) => {
                const dotColor =
                  nail.colorHex || DEFAULT_DOT_PALETTE[idx % DEFAULT_DOT_PALETTE.length];
                const hasWidth = typeof nail.width_mm === "number" && nail.width_mm > 0;

                return (
                  <div
                    key={`${nail.finger}-${idx}`}
                    className="inline-flex items-center gap-2 rounded-full border border-lavender/70 bg-gradient-to-r from-blush/25 to-lavender/25 px-4 py-2 text-xs sm:text-sm shadow-xs"
                  >
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="font-semibold text-foreground">{nail.finger}</span>
                    <span className="text-muted-foreground">—</span>
                    <span className="font-mono font-bold text-primary">
                      {hasWidth ? `${nail.width_mm!.toFixed(2)} mm` : "Uncalibrated"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground">
            Showing {detectedNails.length} detected nail{detectedNails.length === 1 ? "" : "s"} · Optical millimeter estimates may vary slightly with camera angle and lighting.
          </p>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2 & 3. SELECT BRAND + CONDITIONAL SHAPE DROPDOWNS & BRAND RESULTS     */}
      {/* ==================================================================== */}
      <BrandFitComparison
        results={results}
        selectedBrandId={selectedBrandId}
        onBrandSelect={onBrandSelect || (() => {})}
        sectionRef={brandSectionRef}
      />

      {/* ==================================================================== */}
      {/* 4. ACTIONS — DOWNLOAD SIZE CARD, COMPARE ANOTHER BRAND, SAVE PROFILE */}
      {/* ==================================================================== */}
      <section className="rounded-3xl border border-lavender/70 bg-gradient-to-br from-card via-card to-lavender/20 p-5 sm:p-8 shadow-soft space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-lavender/50">
          <div>
            <h3 className="font-display text-2xl font-bold text-foreground">
              Save or Export Your Size Card
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Download your calibrated millimeter card, test another brand, or save locally in this browser.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5 rounded-full text-xs font-semibold text-primary hover:bg-lavender/30 self-start sm:self-auto"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Clipboard className="size-3.5" />}
            {copied ? "Copied!" : "Copy Measurements"}
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            <Button
              size="default"
              onClick={handleDownload}
              disabled={downloading}
              className="gap-2 font-semibold"
            >
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {downloading ? "Generating PDF..." : "Download Size Card"}
            </Button>

            <Button
              variant="outline"
              size="default"
              onClick={handleCompareAnotherBrand}
              className="gap-2 font-semibold border-lavender-deep/40 bg-background hover:bg-lavender/20"
            >
              <ArrowLeftRight className="size-4 text-primary" />
              Compare Another Brand
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="text"
              aria-label="Profile nickname"
              placeholder="Profile name (optional)"
              value={saveNickname}
              onChange={(e) => setSaveNickname(e.target.value)}
              className="rounded-full border border-lavender-deep/35 bg-background px-4 py-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-44 shadow-xs"
            />
            <Button
              variant="blush"
              size="default"
              onClick={handleSaveLocally}
              className="gap-2 font-semibold border border-blush shrink-0"
            >
              {isSavedLocally ? <Check className="size-4 text-emerald-700" /> : <Bookmark className="size-4 text-primary" />}
              {isSavedLocally ? "Saved!" : "Save Size Profile"}
            </Button>
          </div>
        </div>

        {isSavedLocally && (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Size profile saved locally to this browser for quick reference.
          </p>
        )}
      </section>

      {/* Floating Clipboard Notification */}
      {copied && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <Check className="size-4 text-emerald-400" />
          <span>Sizes copied to clipboard!</span>
        </div>
      )}
    </div>
  );
}
