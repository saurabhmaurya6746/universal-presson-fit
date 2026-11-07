import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getBrands, getBrandById } from "@/services/brandService";
import { matchResultsToBrand } from "@/services/brandMatchingService";
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
  // Filter out brands whose sizing chart visibility is hidden
  const allBrands = useMemo(
    () => getBrands().filter((b) => b.chartVisibility !== "hidden"),
    []
  );

  const activeBrand = useMemo(() => {
    if (!selectedBrandId) return null;
    return getBrandById(selectedBrandId) || null;
  }, [selectedBrandId]);

  const matchData = useMemo(() => {
    if (!activeBrand) return null;
    return matchResultsToBrand(results, activeBrand);
  }, [activeBrand, results]);

  return (
    <div className="mb-10 rounded-xl border border-border bg-card p-6 sm:p-8">
      {/* Brand Selector Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-muted text-foreground">
              <Building2 className="size-4" />
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">
              Partner Brand Size Match
            </h3>
            <span className="rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              Optional
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Compare your estimated millimeter measurements against brand sizing charts.
          </p>
        </div>

        {/* Brand Dropdown */}
        <div className="flex items-center gap-2.5">
          <label htmlFor="brand-match-select" className="text-xs font-semibold text-muted-foreground shrink-0">
            Brand Chart:
          </label>
          <select
            id="brand-match-select"
            value={activeBrand?.id || activeBrand?.slug || ""}
            onChange={(e) => onBrandSelect(e.target.value || null)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
          >
            <option value="">None (Universal Millimeter Measurements Only)</option>
            {allBrands.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name} (Sample Brand)
              </option>
            ))}
          </select>

          {activeBrand && (
            <button
              type="button"
              onClick={() => onBrandSelect(null)}
              className="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              title="Remove brand comparison and view universal results"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* When NO brand is selected */}
      {!activeBrand && (
        <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl bg-muted/40 p-5 border border-border/60">
          <div className="flex items-center gap-3">
            <Building2 className="size-5 text-muted-foreground shrink-0" />
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground block">
                Currently displaying Universal Millimeter Measurements
              </span>
              No specific brand sizing is applied. Select any press-on brand from the dropdown above to translate your millimeter measurements to their sizing chart.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBrandSelect(allBrands[0]?.slug || null)}
              className="text-xs whitespace-nowrap"
            >
              Compare with {allBrands[0]?.name || "Sample Brand"}
            </Button>
          </div>
        </div>
      )}

      {/* When a brand IS selected */}
      {activeBrand && matchData && (
        <div className="mt-6 space-y-6">
          {/* Active Brand Headline & Overall Recommendation */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl bg-muted/30 border border-border p-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Brand
                </span>
                <span className="text-xs font-bold text-foreground">
                  {activeBrand.name}
                </span>
                <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5">
                  Sample Brand Chart
                </span>
              </div>
              <h4 className="mt-1 text-xl font-bold text-foreground">
                Recommended Fit: {matchData.overallSetSize}
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Based on {activeBrand.sizingChart.chartName} (calibrated in millimeters)
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs bg-background">
                <Link to={`/brands/${activeBrand.slug}`} target="_blank">
                  View Full Brand Chart
                  <ExternalLink className="size-3" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Finger-by-Finger Brand Recommendation Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="py-3 px-4">Finger</th>
                  <th className="py-3 px-3">Your Measured Width</th>
                  <th className="py-3 px-3">Brand Chart Spec</th>
                  <th className="py-3 px-3">Recommended Size</th>
                  <th className="py-3 px-4">Fit Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {matchData.fingerFits.map((fit) => (
                  <tr key={fit.finger} className="hover:bg-muted/30 transition-colors">
                    {/* Finger Name & Color Dot */}
                    <td className="py-3.5 px-4 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        {fit.colorHex && (
                          <span
                            className="inline-block size-3 rounded-full shrink-0 shadow-xs ring-1 ring-black/10"
                            style={{ backgroundColor: fit.colorHex }}
                          />
                        )}
                        <span>{fit.finger}</span>
                      </div>
                    </td>

                    {/* Measured mm (Preserved exactly) */}
                    <td className="py-3.5 px-3 font-mono font-medium text-foreground">
                      {typeof fit.measuredWidthMm === "number"
                        ? `${fit.measuredWidthMm.toFixed(2)} mm`
                        : "—"}
                    </td>

                    {/* Brand Chart Target mm */}
                    <td className="py-3.5 px-3 font-mono text-muted-foreground">
                      {fit.chartRange ? (
                        <span>{fit.chartRange.minMm}–{fit.chartRange.maxMm} mm</span>
                      ) : typeof fit.chartWidthMm === "number" ? (
                        `${fit.chartWidthMm} mm`
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Recommended Brand Size ("Nail 1 → Size X") */}
                    <td className="py-3.5 px-3">
                      {fit.fitStatus === "no_match" ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          <AlertCircle className="size-3" />
                          No matching size
                        </span>
                      ) : fit.fitStatus === "uncalibrated" ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Pending Coin
                        </span>
                      ) : fit.fitStatus === "withheld" ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                          Withheld
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
                          <span className="rounded-md bg-secondary text-secondary-foreground text-xs font-bold px-2 py-0.5">
                            {fit.displayRecommendation || `${fit.finger} → Size ${fit.recommendedSize}`}
                          </span>
                          {fit.fitStatus === "exact" && (
                            <span className="text-[10px] text-emerald-600 font-sans font-semibold">
                              (Exact)
                            </span>
                          )}
                        </span>
                      )}
                    </td>

                    {/* Explanation */}
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      {fit.explanation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recommendation Rule & Integrity Note */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl bg-muted/40 p-4 text-[11px] sm:text-xs text-muted-foreground border border-border">
            <div className="flex items-start gap-2">
              <HelpCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Recommendation Rule:</strong> Closest available brand size with width $\ge$ your measured millimeter width. Millimeter measurements from optical estimation are never modified.
              </div>
            </div>
            <button
              type="button"
              onClick={() => onBrandSelect(null)}
              className="text-foreground hover:underline font-semibold shrink-0"
            >
              Hide Brand Fit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
