import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clipboard, Download, Check, Loader2, RotateCcw, Cpu, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadSizeCardPdf, generateClipboardSizeText } from "@/services/sizeFinderService";
import type { NailSizeResult } from "@/types";

export interface SizeFinderResultsProps {
  results: NailSizeResult;
  onReset: () => void;
}

export function SizeFinderResults({ results, onReset }: SizeFinderResultsProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
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

  const getSortKey = (name: string): number => {
    const numMatch = name.match(/Nail\s*(\d+)/i);
    if (numMatch) return parseInt(numMatch[1], 10);
    const fingers = ["thumb", "index", "middle", "ring", "pinky"];
    const lower = name.toLowerCase();
    for (let i = 0; i < fingers.length; i++) {
      if (lower.includes(fingers[i])) return i + 1;
    }
    return 99;
  };

  const rawItems = results.measurements || results.leftHand || [];
  const fingerItems = rawItems
    .slice()
    .sort((a, b) => getSortKey(a.finger) - getSortKey(b.finger));

  return (
    <div>
      <div className="text-center">
        <span className="inline-block rounded-full bg-blush px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-foreground">
          {results.isDemo ? "Demo results · not a measurement" : "AI Verified Measurements"}
        </span>
        <h2 className="mt-7 font-display text-5xl sm:text-6xl">
          Your Recommended Nail Sizes
        </h2>
        <p className="mt-4 text-muted-foreground">
          Precision calibrated with your physical ₹10 reference coin. Use these custom sizes for your press-on order.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* Computer Vision Detection Image */}
        {results.processed_image_url ? (
          <section className="bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-3xl">AI Detection View</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  ₹10 coin scale verification and segmented nail boundaries
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="gap-1.5 text-xs shrink-0"
              >
                <RotateCcw className="size-3.5" />
                Retake
              </Button>
            </div>
            <div className="mt-4 flex min-h-72 items-center justify-center overflow-hidden rounded-md bg-lavender/20 p-2">
              <img
                src={results.processed_image_url}
                alt="AI Computer Vision Processed Hand"
                className="max-h-80 w-auto rounded object-contain shadow-sm"
              />
            </div>
            {/* Color-Coded Nail Legend matching the Detection Overlay */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="inline-block size-3 rounded-full bg-blue-600"></span>
                ₹10 Reference Coin
              </span>
              {fingerItems.map((item, idx) => {
                const paletteColors = ["#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];
                const color = item.colorHex || paletteColors[idx % paletteColors.length];
                return (
                  <span key={item.finger} className="flex items-center gap-1.5 font-medium text-foreground">
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: color }}
                    ></span>
                    {item.finger}
                  </span>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Verified Finger Measurements */}
        <section className="bg-card p-6 shadow-soft rounded-2xl border border-border">
          <h3 className="font-display text-3xl">Hand Measurements</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Calibrated natural nail widths in millimeters matching detection overlay
          </p>

          {results.validation && !results.validation.passed && (
            <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive text-left">
              <div className="flex items-center gap-1.5 font-bold text-destructive text-xs uppercase tracking-wide">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Photo Quality Verification Failed</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed font-semibold">
                {results.validation.primaryError || "Photo does not meet precision measurement criteria."}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Final press-on size recommendations have been withheld for safety. Please retake the photo following the guidance.
              </p>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReset}
                  className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <RotateCcw className="size-3.5" />
                  Retake Photo Now
                </Button>
              </div>
            </div>
          )}

          {!results.coin_detected && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-900 text-left">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 text-xs">
                <span>⚠</span>
                <span>₹10 Reference Coin Calibration Missing</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed">
                {results.calibration_message ||
                  "Please upload an image with a clearly visible verified ₹10 coin on the same flat surface."}
              </p>
            </div>
          )}

          <div className="mt-4 divide-y divide-border">
            {fingerItems.map((item, idx) => {
              const paletteColors = ["#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];
              const color = item.colorHex || paletteColors[idx % paletteColors.length];

              const isValidationFailed = Boolean(
                (results.validation && !results.validation.passed) ||
                item.recommended_size === "Validation Failed" ||
                item.size === "Validation Failed"
              );
              const isPending =
                !isValidationFailed &&
                (item.recommended_size === "Pending Calibration" ||
                  item.size === "Pending Calibration");
              const isOutOfRange =
                !isValidationFailed &&
                (item.recommended_size === "Outside supported size range" ||
                  item.size === "Outside supported size range");
              const displaySize = isValidationFailed
                ? "Withheld"
                : isPending
                ? "Pending Coin"
                : item.recommended_size ||
                  (item.size && !isNaN(Number(item.size))
                    ? `Size ${item.size}`
                    : item.size || "Unknown");

              return (
                <div
                  key={item.finger}
                  className="grid grid-cols-[1.5fr_auto_auto] items-center gap-4 py-3.5"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="size-3.5 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: color }}
                      title={`${item.finger} detection overlay color`}
                    />
                    <div>
                      <span className="font-bold text-foreground text-sm block">
                        {item.finger}
                      </span>
                      <div className="mt-0.5 text-xs text-foreground font-semibold">
                        {typeof item.width_mm === "number" ? (
                          <span>{item.finger} width: {item.width_mm.toFixed(2)} mm</span>
                        ) : (
                          <span className="text-amber-700 font-normal">(Calibrated mm requires verified ₹10 coin)</span>
                        )}
                        {typeof item.height_mm === "number" && (
                          <span className="text-muted-foreground font-normal"> · {item.height_mm.toFixed(2)} mm height</span>
                        )}
                      </div>
                      <details className="mt-1 text-[11px] text-muted-foreground cursor-pointer">
                        <summary className="hover:text-foreground">Technical pixel dimensions</summary>
                        <div className="mt-1 text-[10px] text-muted-foreground font-mono pl-1">
                          {typeof item.raw_width === "number" && typeof item.raw_height === "number"
                            ? `${item.raw_width.toFixed(1)} px × ${item.raw_height.toFixed(1)} px`
                            : "—"}
                          {item.confidence && ` · ${Math.round(item.confidence * 100)}% conf`}
                        </div>
                      </details>
                    </div>
                  </div>
                  <div className="text-right">
                    {isValidationFailed ? (
                      <span className="inline-block rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                        Withheld
                      </span>
                    ) : isPending ? (
                      <span className="inline-block rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Pending Coin
                      </span>
                    ) : isOutOfRange ? (
                      <span className="inline-block rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Outside supported size range
                      </span>
                    ) : (
                      <b className="font-display text-2xl text-foreground">
                        {displaySize}
                      </b>
                    )}
                  </div>
                  {isValidationFailed ? (
                    <span className="rounded-full bg-destructive/15 px-3 py-1 text-[10px] font-bold uppercase text-destructive">
                      Rejected
                    </span>
                  ) : isPending ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase text-amber-800">
                      Uncalibrated
                    </span>
                  ) : isOutOfRange ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase text-amber-800">
                      Custom Sizing
                    </span>
                  ) : (
                    <span className="rounded-full bg-mint px-3 py-1 text-[10px] font-bold uppercase text-foreground">
                      AI Fit
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Summary Profile & Actions */}
      <div className="mt-8 bg-lavender/25 p-7 rounded-2xl border border-lavender-deep/20">
        <h3 className="font-display text-3xl">Universal Millimeter Size Profile</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Calibrated using ₹10 optical scale standard. Compare against any press-on brand chart.
        </p>
        <p className="mt-3 break-words font-mono text-sm text-foreground">
          {results.summaryProfile}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="size-4 text-emerald-600" /> : <Clipboard className="size-4" />}
            {copied ? "Sizes copied!" : "Copy My Sizes"}
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {downloading ? "Generating PDF..." : "Download Size Card"}
          </Button>
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="size-4" />
            Retake
          </Button>
          <Button asChild>
            <Link to="/brands">Browse Brand Sizing Charts</Link>
          </Button>
          <Button variant="outline" onClick={handleBookAppointment}>
            Book Studio Custom Set
          </Button>
        </div>

        {/* Optional Local Profile Save (Demo / Local Storage) */}
        <div className="mt-6 pt-5 border-t border-border/60">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Save Size Profile for Future Use (Optional)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Demo Mode: No account required. Saved locally in this browser's localStorage.
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Profile nickname (e.g. My Nails)"
                value={saveNickname}
                onChange={(e) => setSaveNickname(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary w-full sm:w-44"
              />
              <Button size="sm" variant="outline" onClick={handleSaveLocally} className="text-xs shrink-0">
                {isSavedLocally ? "Saved!" : "Save Profile"}
              </Button>
            </div>
          </div>
          {isSavedLocally && (
            <p className="mt-2 text-xs text-emerald-600 font-medium">
              Profile saved locally to this browser! (Local Demo Storage)
            </p>
          )}
        </div>
      </div>

      {copied && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-2xl"
        >
          <Check className="size-4 text-emerald-400" />
          <span>Sizes copied!</span>
        </div>
      )}

      {/* Development AI Diagnostics Panel (Phase 15) */}
      {results.debugInfo && (
        <div className="mt-8 text-center">
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
            <div className="mt-4 rounded-2xl border border-border bg-card/90 p-5 text-left text-xs font-mono shadow-sm">
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
                  <span className="text-muted-foreground block text-[11px]">Input Shape</span>
                  <span className="text-foreground">{results.debugInfo.inputShapes.join(", ")}</span>
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
                  <span className="text-muted-foreground block text-[11px]">Postprocess Latency</span>
                  <span className="text-foreground">{results.debugInfo.postprocessTimeMs} ms</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Total Client Latency</span>
                  <span className="font-bold text-emerald-600">{results.debugInfo.totalTimeMs} ms</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Thresholds</span>
                  <span className="text-foreground">Conf: {(results.debugInfo.confidenceThreshold * 100).toFixed(0)}% · IoU: {(results.debugInfo.iouThreshold * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
                Outputs: {results.debugInfo.outputShapes.join(" | ")}
              </div>

              {/* ₹10 Reference Coin Calibration Diagnostics */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-xs uppercase tracking-wide">
                    ₹10 Reference Coin Calibration
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      results.coin_detected
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {results.coin_detected ? "Calibrated" : "Uncalibrated"}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">Calibration Status</span>
                    <span className="font-bold text-foreground">
                      {results.coin_detected ? "Verified ₹10 Coin" : "Not Detected"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Detected Coin</span>
                    <span className="font-bold text-emerald-600">
                      {results.calibration?.detectedDiameterPx
                        ? `${results.calibration.detectedDiameterPx.toFixed(1)} px diameter`
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Reference Diameter</span>
                    <span className="text-foreground">
                      {results.calibration?.referenceDiameterMm || 27} mm ({results.calibration?.pixelsPerMm?.toFixed(2)} px/mm)
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Center / Radius</span>
                    <span className="text-foreground">
                      {results.calibration?.center && results.calibration?.radius
                        ? `[${results.calibration.center.join(", ")}] · r=${results.calibration.radius}px`
                        : "—"}
                    </span>
                  </div>
                </div>

                {results.calibration?.candidates && results.calibration.candidates.length > 0 && (
                  <div className="mt-3">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-1.5">
                      Candidate Circles Evaluated
                    </span>
                    <div className="overflow-x-auto max-h-48 border border-border/80 rounded-lg">
                      <table className="w-full text-left text-[11px] font-mono">
                        <thead className="bg-muted/50 border-b border-border/80 text-[10px] text-muted-foreground uppercase">
                          <tr>
                            <th className="p-1.5">Candidate</th>
                            <th className="p-1.5">Status</th>
                            <th className="p-1.5">Conf</th>
                              <th className="p-1.5">Diameter</th>
                            <th className="p-1.5">Edge / Color Signals</th>
                            <th className="p-1.5">Decision Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {results.calibration.candidates.map((cand, cIdx) => (
                            <tr
                              key={cIdx}
                              className={
                                cand.status === "selected"
                                  ? "bg-emerald-50/50 font-bold"
                                  : "text-muted-foreground hover:bg-muted/20"
                              }
                            >
                              <td className="p-1.5 text-foreground">
                                [{cand.center.join(",")}]
                              </td>
                              <td className="p-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                                    cand.status === "selected"
                                      ? "bg-emerald-200 text-emerald-900"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {cand.status}
                                </span>
                              </td>
                              <td className="p-1.5">
                                {(cand.confidence * 100).toFixed(0)}%
                              </td>
                              <td className="p-1.5">{cand.diameterPx}px</td>
                              <td className="p-1.5 text-[10px]">
                                {cand.edgeSupport !== undefined
                                  ? `Edge: ${(cand.edgeSupport * 100).toFixed(0)}% · Δb: ${cand.bDiff ?? 0} · Ring: ${cand.ringMinB ?? 0}`
                                  : cand.outerCoverage !== undefined
                                  ? `${(cand.outerCoverage * 100).toFixed(0)}% cov`
                                  : "—"}
                              </td>
                              <td className="p-1.5 text-[10px]">
                                {cand.reason || (cand.status === "selected" ? "Verified reference coin" : "—")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Photo Quality & Safety Validation (Phase 16) */}
              {results.validation && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-xs uppercase tracking-wide">
                      Photo Quality & Safety Validation
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        results.validation.passed
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {results.validation.passed ? "Passed" : "Failed"}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block">Image Resolution</span>
                      <span className="font-bold text-foreground">
                        {results.validation.diagnostics.imageResolution.width} × {results.validation.diagnostics.imageResolution.height} px
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Scale / Min Dim</span>
                      <span className="text-foreground">
                        {results.validation.diagnostics.pixelsPerMm > 0
                          ? `${results.validation.diagnostics.pixelsPerMm.toFixed(2)} px/mm`
                          : "Uncalibrated"}{" "}
                        · Min: {results.validation.diagnostics.minImageDimension}px
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Nail Count</span>
                      <span className="font-bold text-foreground">
                        {results.validation.diagnostics.nailCount} nails detected
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Finger Labels</span>
                      <span className="text-foreground">
                        {results.validation.diagnostics.fingerLabels.join(", ") || "None"}
                      </span>
                    </div>
                  </div>

                  {/* Nail Metrics Table */}
                  {results.validation.diagnostics.nailMetrics && results.validation.diagnostics.nailMetrics.length > 0 && (
                    <div className="mt-3">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-1.5">
                        Nail Rotated Rectangle Metrics (minAreaRect)
                      </span>
                      <div className="overflow-x-auto border border-border/80 rounded-lg">
                        <table className="w-full text-left text-[11px] font-mono">
                          <thead className="bg-muted/50 border-b border-border/80 text-[10px] text-muted-foreground uppercase">
                            <tr>
                              <th className="p-1.5">Finger</th>
                              <th className="p-1.5">Pixel Dim (W × H)</th>
                              <th className="p-1.5">Calibrated (W × H)</th>
                              <th className="p-1.5">Aspect</th>
                              <th className="p-1.5">Angle</th>
                              <th className="p-1.5">Contour Pts</th>
                              <th className="p-1.5">Bounding Box</th>
                              <th className="p-1.5">Mask Px</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {results.validation.diagnostics.nailMetrics.map((nm, idx) => (
                              <tr key={idx} className="hover:bg-muted/20">
                                <td className="p-1.5 font-bold text-foreground">{nm.finger}</td>
                                <td className="p-1.5 text-foreground font-semibold">
                                  {nm.widthPx.toFixed(1)} × {nm.heightPx.toFixed(1)} px
                                </td>
                                <td className="p-1.5">
                                  {nm.widthMm !== undefined && nm.heightMm !== undefined ? (
                                    <span>{nm.widthMm.toFixed(2)} × {nm.heightMm.toFixed(2)} mm</span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="p-1.5">
                                  <span className={nm.aspectRatio > 2.2 ? "text-destructive font-bold" : ""}>
                                    {nm.aspectRatio.toFixed(2)}
                                  </span>
                                </td>
                                <td className="p-1.5 text-muted-foreground">
                                  {nm.angleDeg !== undefined ? `${nm.angleDeg.toFixed(1)}°` : "—"}
                                </td>
                                <td className="p-1.5 text-muted-foreground">
                                  {nm.contourPointCount !== undefined ? `${nm.contourPointCount} pts` : "—"}
                                </td>
                                <td className="p-1.5 text-[10px] text-muted-foreground">
                                  {nm.boundingBox ? `[${nm.boundingBox.join(",")}]` : "—"}
                                </td>
                                <td className="p-1.5 text-muted-foreground">
                                  {nm.maskPixels !== undefined ? `${nm.maskPixels} px` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Finger Separation & Longitudinal Curl Checks */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {results.validation.diagnostics.fingerSeparation && results.validation.diagnostics.fingerSeparation.length > 0 && (
                      <div className="border border-border/80 rounded-lg p-2.5">
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-1">
                          Adjacent Finger Separation (≥ 0.75× avg width)
                        </span>
                        <div className="space-y-1">
                          {results.validation.diagnostics.fingerSeparation.map((sep, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[10px]">
                              <span>{sep.pair}</span>
                              <span className={sep.passed ? "text-emerald-700" : "text-destructive font-bold"}>
                                {sep.distancePx.toFixed(0)}px ({sep.ratio.toFixed(2)}×) {sep.passed ? "✓" : "✗ Too close"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {results.validation.diagnostics.longitudinalDisplacementMm !== undefined && (
                      <div className="border border-border/80 rounded-lg p-2.5">
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-1">
                          Longitudinal Curl / Retraction (≤ 22mm)
                        </span>
                        <div className="text-[11px]">
                          <span>Index vs Middle Displacement: </span>
                          <span
                            className={
                              results.validation.diagnostics.longitudinalDisplacementMm <= 22
                                ? "font-bold text-emerald-700"
                                : "font-bold text-destructive"
                            }
                          >
                            {results.validation.diagnostics.longitudinalDisplacementMm.toFixed(1)} mm
                          </span>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            {results.validation.diagnostics.longitudinalDisplacementMm <= 22
                              ? "Fingers extended in flat plane (Passed)"
                              : "Severe curling or retraction detected (Failed)"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Issues List */}
                  {results.validation.issues && results.validation.issues.length > 0 && (
                    <div className="mt-3">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-1">
                        Validation Findings & Warnings ({results.validation.issues.length})
                      </span>
                      <div className="space-y-1">
                        {results.validation.issues.map((iss, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded text-[11px] flex items-start gap-2 ${
                              iss.severity === "error"
                                ? "bg-destructive/10 text-destructive border border-destructive/20"
                                : "bg-amber-50 text-amber-900 border border-amber-200"
                            }`}
                          >
                            <span className="font-bold uppercase text-[9px] px-1 py-0.5 rounded bg-background">
                              {iss.severity}
                            </span>
                            <div>
                              <span className="font-semibold">{iss.code}: </span>
                              <span>{iss.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="mx-auto mt-8 block cursor-pointer text-sm text-muted-foreground underline transition-colors hover:text-foreground"
        onClick={onReset}
      >
        Try another photo
      </button>
    </div>
  );
}
