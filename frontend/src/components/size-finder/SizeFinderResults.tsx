import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Clipboard,
  Download,
  Check,
  Loader2,
  RotateCcw,
  Cpu,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Sparkles,
  ArrowLeftRight,
  Eye,
  Bookmark,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadSizeCardPdf, generateClipboardSizeText } from "@/services/sizeFinderService";
import { resolveFingerKey } from "@/services/brandMatchingService";
import { BrandFitComparison } from "@/components/brand/BrandFitComparison";
import type { NailSizeResult, FingerSize } from "@/types";

export interface SizeFinderResultsProps {
  results: NailSizeResult;
  onReset: () => void;
  selectedBrandId?: string | null;
  onBrandSelect?: (brandId: string | null) => void;
}

export function SizeFinderResults({
  results,
  onReset,
  selectedBrandId,
  onBrandSelect,
}: SizeFinderResultsProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [saveNickname, setSaveNickname] = useState("");
  const [isSavedLocally, setIsSavedLocally] = useState(false);

  const handleSaveLocally = () => {
    const name = saveNickname.trim() || "My Saved Fit";
    try {
      const existing = JSON.parse(
        localStorage.getItem("presson_fit_saved_profiles_demo") || "[]"
      );
      existing.unshift({
        id: "prof-" + Date.now(),
        nickname: name,
        savedAt: new Date().toLocaleDateString(),
        summary: results.summaryProfile,
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

  const handleBookAppointment = () => {
    try {
      sessionStorage.setItem("aura_active_ai_booking", JSON.stringify(results));
    } catch {
      // ignore storage error
    }
    navigate("/booking", {
      state: {
        source: "ai",
        sizeResult: results,
      },
    });
  };

  // Sort and separate measurements into canonical 5 anatomical fingers and any extra detections
  const { anatomicalFingers, extraDetections } = useMemo(() => {
    const rawItems: FingerSize[] = results.measurements || results.leftHand || results.rightHand || [];

    const canonicalOrder = [
      { key: "thumb", name: "Thumb", defaultIdx: 1 },
      { key: "index", name: "Index", defaultIdx: 2 },
      { key: "middle", name: "Middle", defaultIdx: 3 },
      { key: "ring", name: "Ring", defaultIdx: 4 },
      { key: "pinky", name: "Pinky", defaultIdx: 5 },
    ] as const;

    const assignedSlots = new Map<string, FingerSize>();
    const extras: FingerSize[] = [];
    const paletteColors = ["#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

    // First pass: assign to canonical slot by resolved key
    rawItems.forEach((item) => {
      const fKey = resolveFingerKey(item.finger);
      if (fKey && !assignedSlots.has(fKey)) {
        assignedSlots.set(fKey, item);
      } else {
        extras.push(item);
      }
    });

    const primaryList = canonicalOrder.map((slot, sIdx) => {
      const item = assignedSlots.get(slot.key);
      const color = item?.colorHex || paletteColors[sIdx % paletteColors.length];
      return {
        key: slot.key,
        name: slot.name,
        item,
        color,
      };
    });

    return {
      anatomicalFingers: primaryList,
      extraDetections: extras,
    };
  }, [results]);

  const hasValidationFailed = Boolean(results.validation && !results.validation.passed);
  const isUncalibrated = !results.coin_detected;

  return (
    <div className="space-y-10">
      {/* ==================================================================== */}
      {/* SECTION A — RESULTS HEADER                                           */}
      {/* ==================================================================== */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Subtle Success Indicator */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{results.isDemo ? "Demo Results" : "Analysis Complete"}</span>
              </span>

              {isUncalibrated && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300 border border-amber-500/20">
                  <AlertTriangle className="size-3 text-amber-600" />
                  <span>Uncalibrated (₹10 Coin Missing)</span>
                </span>
              )}

              {hasValidationFailed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive border border-destructive/20">
                  <AlertTriangle className="size-3" />
                  <span>Quality Warning</span>
                </span>
              )}
            </div>

            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Your Nail Measurements
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Your hand photo has been analyzed. Here are your estimated natural nail measurements.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              <RotateCcw className="size-3.5 text-muted-foreground" />
              Retake Photo
            </Button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION B — MEASUREMENT RESULTS                                      */}
      {/* ==================================================================== */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/60">
          <div>
            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Natural Nail Dimensions
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Calibrated natural nail widths in millimeters for each hand finger
            </p>
          </div>

          {results.processed_image_url && (
            <button
              type="button"
              onClick={() => setShowOverlay(!showOverlay)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Eye className="size-3.5" />
              <span>{showOverlay ? "Hide Hand Photo Overlay" : "View Hand Photo Overlay"}</span>
              {showOverlay ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          )}
        </div>

        {/* Validation Error Banner if photo quality check failed */}
        {hasValidationFailed && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive text-left space-y-2">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Photo Quality Verification Alert</span>
            </div>
            <p className="text-xs leading-relaxed font-semibold">
              {results.validation?.primaryError || "Photo does not meet precision measurement criteria."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Measurements are estimated; brand-matching recommendations may be limited. You can retake the photo under even lighting.
            </p>
          </div>
        )}

        {/* Uncalibrated Banner if coin missing */}
        {isUncalibrated && !hasValidationFailed && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <span>₹10 Reference Coin Missing</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {results.calibration_message ||
                "Without a verified ₹10 coin on the same surface, millimeter measurements are approximate optical estimates."}
            </p>
          </div>
        )}

        {/* Responsive Grid of Canonical 5 Hand Fingers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {anatomicalFingers.map((slot) => {
            const item = slot.item;
            const hasWidth = typeof item?.width_mm === "number";

            return (
              <div
                key={slot.key}
                className="relative flex flex-col justify-between rounded-xl border border-border/80 bg-background/80 p-4 transition-all hover:border-border hover:shadow-xs"
              >
                <div>
                  {/* Finger Header with overlay color dot */}
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="size-3 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: slot.color }}
                        title={`${slot.name} detection overlay color`}
                      />
                      <span className="font-display text-sm font-bold text-foreground">
                        {slot.name}
                      </span>
                    </div>
                    {item && item.finger !== slot.name && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {item.finger.replace("Nail ", "N")}
                      </span>
                    )}
                  </div>

                  {/* Measured Width in Millimeters */}
                  <div className="my-2">
                    {hasWidth ? (
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono text-2xl font-bold tracking-tight text-foreground">
                          {item!.width_mm!.toFixed(1)}
                        </span>
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          mm
                        </span>
                      </div>
                    ) : item ? (
                      <span className="text-xs text-amber-700 dark:text-amber-400 font-medium block">
                        Uncalibrated
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground block">
                        Not in frame
                      </span>
                    )}
                  </div>
                </div>

                {/* Secondary Status & Dimensions */}
                <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-0.5">
                  {typeof item?.height_mm === "number" && (
                    <div className="font-mono text-[10px]">
                      {item.height_mm.toFixed(1)} mm length
                    </div>
                  )}
                  {item?.recommended_size && item.recommended_size !== "Pending Calibration" && (
                    <div className="font-medium text-foreground text-[10px] truncate">
                      {item.recommended_size.replace("Validation Failed", "Withheld")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Extra Detections Handling (>5 nails detected) */}
        {extraDetections.length > 0 && (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground block">
                  Additional Detected Boundaries ({extraDetections.length})
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Additional detections from the image preserved without altering standard 5-finger anatomical mapping.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {extraDetections.map((extra, eIdx) => (
                <div
                  key={extra.finger || eIdx}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono space-y-0.5 shadow-xs"
                >
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: extra.colorHex || "#a855f7" }}
                    />
                    <span>{extra.finger || `Detection #${eIdx + 6}`}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Width: {typeof extra.width_mm === "number" ? `${extra.width_mm.toFixed(1)} mm` : "—"}
                    {extra.confidence && ` · ${(extra.confidence * 100).toFixed(0)}% conf`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Required Small Note */}
        <p className="text-[11px] text-muted-foreground text-center sm:text-left italic">
          Measurements are optical estimates and may vary slightly depending on photo conditions.
        </p>

        {/* Collapsible AI Detection View with ₹10 Coin & Legend */}
        {showOverlay && results.processed_image_url && (
          <div className="pt-4 border-t border-border/60 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">AI Vision Contour Verification</span>
              <span>₹10 reference scale & segmented boundaries</span>
            </div>

            <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-xl bg-muted/30 p-3 border border-border/60">
              <img
                src={results.processed_image_url}
                alt="AI Detection Overlay with ₹10 Coin"
                className="max-h-80 w-auto rounded-lg object-contain shadow-xs"
              />
            </div>

            {/* Color-Coded Nail Legend matching the Detection Overlay */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="inline-block size-3 rounded-full bg-blue-600"></span>
                ₹10 Reference Coin
              </span>
              {anatomicalFingers.map((slot) => (
                <span key={slot.key} className="flex items-center gap-1.5 font-medium text-foreground">
                  <span
                    className="inline-block size-3 rounded-full"
                    style={{ backgroundColor: slot.color }}
                  ></span>
                  {slot.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SECTION C & SECTION D — BRAND SELECTION & BRAND SIZING RESULTS        */}
      {/* ==================================================================== */}
      <BrandFitComparison
        results={results}
        selectedBrandId={selectedBrandId}
        onBrandSelect={onBrandSelect || (() => {})}
      />

      {/* ==================================================================== */}
      {/* SECTION E — ACTIONS                                                  */}
      {/* ==================================================================== */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-6">
        <div className="pb-4 border-b border-border/60">
          <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Size Profile & Actions
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Universal millimeter profile: {results.summaryProfile}
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 text-xs font-semibold shadow-xs">
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Clipboard className="size-3.5" />}
            {copied ? "Sizes Copied!" : "Copy My Sizes"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            className="gap-2 text-xs font-semibold shadow-xs"
          >
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {downloading ? "Generating PDF..." : "Download Size Card"}
          </Button>

          <Button variant="outline" size="sm" onClick={onReset} className="gap-2 text-xs font-semibold shadow-xs">
            <RotateCcw className="size-3.5 text-muted-foreground" />
            Retake Photo
          </Button>

          {selectedBrandId && onBrandSelect && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBrandSelect(null)}
              className="gap-2 text-xs font-semibold shadow-xs text-primary hover:text-primary"
            >
              <ArrowLeftRight className="size-3.5" />
              Compare Another Brand
            </Button>
          )}

          <Button asChild size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-foreground">
            <Link to="/brands">Browse All Brand Charts</Link>
          </Button>

          <Button size="sm" variant="ghost" onClick={handleBookAppointment} className="text-xs text-muted-foreground hover:text-foreground">
            Book Custom Set
          </Button>
        </div>

        {/* Local Profile Save (Demo / Local Storage) */}
        <div className="pt-4 border-t border-border/60">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Bookmark className="size-3.5 text-primary" />
                Save Size Profile (Local Storage)
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                Demo Mode: Saved directly in this browser for quick reference.
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Profile nickname (e.g. My Nails)"
                value={saveNickname}
                onChange={(e) => setSaveNickname(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary w-full sm:w-48 shadow-xs"
              />
              <Button size="sm" variant="outline" onClick={handleSaveLocally} className="text-xs font-semibold shrink-0 shadow-xs">
                {isSavedLocally ? "Saved!" : "Save Profile"}
              </Button>
            </div>
          </div>

          {isSavedLocally && (
            <p className="mt-2 text-xs text-emerald-600 font-medium">
              Profile saved locally to this browser!
            </p>
          )}
        </div>
      </div>

      {/* Development AI Diagnostics Panel */}
      {results.debugInfo && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <Cpu className="size-3.5" />
            <span>{showDebug ? "Hide AI Diagnostics" : "Show AI Diagnostics (WASM / ONNX)"}</span>
            {showDebug ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>

          {showDebug && (
            <div className="mt-4 rounded-2xl border border-border bg-card/90 p-5 text-left text-xs font-mono shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Model File</span>
                  <span className="font-bold text-foreground">{results.debugInfo.modelName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Execution Provider</span>
                  <span className="font-bold text-emerald-600">{results.debugInfo.executionProvider}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Detections</span>
                  <span className="font-bold text-foreground">{results.debugInfo.numDetections} nails</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Preprocess Latency</span>
                  <span className="text-foreground">{results.debugInfo.preprocessTimeMs} ms</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">ONNX Inference Latency</span>
                  <span className="font-bold text-foreground">{results.debugInfo.inferenceTimeMs} ms</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Total Client Latency</span>
                  <span className="font-bold text-emerald-600">{results.debugInfo.totalTimeMs} ms</span>
                </div>
              </div>

              {/* Coin Calibration Summary in Debug */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span>
                  Coin Scale: {results.coin_detected ? "Verified ₹10 Coin (27.0mm)" : "Not detected"}
                </span>
                {results.calibration?.pixelsPerMm && (
                  <span className="font-bold text-foreground">
                    {results.calibration.pixelsPerMm.toFixed(2)} px/mm
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
