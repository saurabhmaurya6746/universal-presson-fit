import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Globe,
  Instagram,
  MapPin,
  Calendar,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  FileText,
  CheckCircle2,
  Ruler,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import { publicBrandRepository } from "@/services/publicBrandRepository";
import type { PublicBrandProfile } from "@/types/brand";

export function BrandDetailPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const [brand, setBrand] = useState<PublicBrandProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBrand = useCallback(async () => {
    if (!brandId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await publicBrandRepository.getPublicBrandBySlugOrId(brandId);
      setBrand(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load studio profile.");
    } finally {
      setIsLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    loadBrand();
  }, [loadBrand]);

  const isRemote = publicBrandRepository.isRemoteEnabled();

  if (isLoading) {
    return (
      <div className="section-shell py-24 flex flex-col items-center justify-center text-center">
        <RefreshCw className="size-8 animate-spin text-lavender-deep mb-3" />
        <p className="text-sm font-medium text-foreground">Loading brand profile & sizing chart...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="section-shell py-24 text-center max-w-md mx-auto">
        <AlertCircle className="size-8 text-destructive mx-auto mb-3" />
        <h1 className="font-display text-2xl font-bold text-destructive">Unable to Load Brand</h1>
        <p className="mt-2 text-xs text-muted-foreground">{errorMessage}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={loadBrand} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="size-4" />
            Retry
          </Button>
          <Button asChild size="sm">
            <Link to="/brands">Back to Brands</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="section-shell py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Brand Not Found</h1>
        <p className="mt-3 text-muted-foreground">The requested brand partner could not be located in the directory.</p>
        <Button asChild className="mt-6">
          <Link to="/brands">Back to Brands</Link>
        </Button>
      </div>
    );
  }

  const { sizingChart } = brand;
  const chartFormat = sizingChart?.format || (sizingChart?.ranges && sizingChart.ranges.length > 0 ? "width_ranges" : "preset_set");
  const isLengthOnly =
    chartFormat === "length_only_numbered" ||
    Boolean(sizingChart?.length_numbered_sizes && Object.keys(sizingChart.length_numbered_sizes).length > 0) ||
    Boolean(sizingChart?.sizing_chart_entries?.some((e) => e.length_mm != null && e.width_mm == null));
  const isNumberedSize =
    !isLengthOnly &&
    (chartFormat === "numbered_size" ||
      Boolean(sizingChart?.numbered_sizes && sizingChart.numbered_sizes.length > 0));
  const isShapeRange =
    !isLengthOnly &&
    (chartFormat === "shape_range" ||
      Boolean(sizingChart?.shape_ranges && sizingChart.shape_ranges.length > 0));
  const isWidthRanges =
    !isLengthOnly &&
    chartFormat === "width_ranges" &&
    Boolean(sizingChart?.ranges && sizingChart.ranges.length > 0);
  const sizeKeys = sizingChart ? Object.keys(sizingChart.sizes || {}) : [];
  const locationStr = [brand.city, brand.country].filter(Boolean).join(", ");

  return (
    <>
      <SEO
        title={`${brand.name} | Sizing Chart | Nail World`}
        description={`View ${brand.name} press-on sizing specifications and millimeter finger width recommendations on Nail World.`}
      />

      <div className="section-shell pt-8">
        <Link
          to="/brands"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to all sample brands
        </Link>
      </div>

      <div className="section-shell pt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {brand.logo_url && (
          <img
            src={brand.logo_url}
            alt={`${brand.name} logo`}
            className="size-16 sm:size-20 rounded-2xl object-contain border border-border bg-card p-2 shadow-soft shrink-0"
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider font-semibold text-lavender-deep">
              {brand.is_official ? "Official Brand Sizing" : "Studio Sizing Profile"}
            </span>
            {brand.is_official && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="size-3 text-emerald-600" />
                Official Brand
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground mt-1">
            {brand.name}
          </h1>
          {brand.tagline && (
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">{brand.tagline}</p>
          )}
        </div>
      </div>

      {/* Demo / Status Notice */}
      <div className="section-shell">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-foreground flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              {isRemote ? (
                <strong>Live Nail World View:</strong>
              ) : (
                <strong>Sample Brand Chart (Demo):</strong>
              )}{" "}
              {isRemote
                ? "Sizing chart specifications loaded from public catalog API."
                : "Sizing chart specifications shown below are sample mock templates for UI demonstration."}
            </span>
          </div>
          <Link to="/brand/login" className="text-xs font-semibold text-lavender-deep hover:underline shrink-0">
            For Brands Portal (Demo)
          </Link>
        </div>
      </div>

      <section className="section-shell py-12">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* Main Content: Sizing Chart */}
          <div className="lg:col-span-2 space-y-8">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl font-bold text-foreground">
                      {sizingChart?.chartName || `${brand.name} Sizing Chart`}
                    </h2>
                    <span className="rounded-full bg-lavender/60 px-2 py-0.5 text-[10px] font-semibold text-lavender-deep uppercase">
                      Active
                    </span>
                  </div>
                  {sizingChart && (
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                      <Calendar className="size-3.5" />
                      Last updated: {sizingChart.updatedDate} • Unit: Millimeters ({sizingChart.unit})
                    </p>
                  )}
                </div>

                <Button asChild size="sm" className="gap-1.5 shadow-soft">
                  <Link to={`/ai-nail-size-finder?brand=${encodeURIComponent(brand.slug)}`}>
                    <Sparkles className="size-4" />
                    Measure for this Brand
                  </Link>
                </Button>
              </div>

              {/* Sizing Chart Content */}
              {!sizingChart ? (
                <div className="mt-6 p-6 rounded-xl border border-dashed border-border bg-muted/20 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    Sizing Chart Pending Publication
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This studio has not yet published an active sizing chart.
                  </p>
                </div>
              ) : isLengthOnly ? (
                /* FORMAT E: LENGTH-ONLY NUMBERED SPECIFICATIONS */
                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3.5 text-xs text-purple-950 dark:text-purple-300 flex items-start gap-2.5">
                    <Info className="size-4 shrink-0 text-purple-600 mt-0.5" />
                    <div>
                      <strong>Vertical Length Chart:</strong> Lengths in millimeters measured from cuticle base to tip across numbered sizes #0 (longest) to #9 (shortest). Nail width measurements are not provided by this brand.
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-border/80">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-border/80 bg-accent/30 text-[11px] font-semibold uppercase text-muted-foreground">
                          <th className="py-3 px-4">Shape</th>
                          <th className="py-3 px-2 text-center">#0</th>
                          <th className="py-3 px-2 text-center">#1</th>
                          <th className="py-3 px-2 text-center">#2</th>
                          <th className="py-3 px-2 text-center">#3</th>
                          <th className="py-3 px-2 text-center">#4</th>
                          <th className="py-3 px-2 text-center">#5</th>
                          <th className="py-3 px-2 text-center">#6</th>
                          <th className="py-3 px-2 text-center">#7</th>
                          <th className="py-3 px-2 text-center">#8</th>
                          <th className="py-3 px-2 text-center">#9</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {(() => {
                          const shapesMap: Record<string, Record<string, number>> = { ...(sizingChart.length_numbered_sizes || {}) };
                          if (Object.keys(shapesMap).length === 0 && sizingChart.sizing_chart_entries) {
                            for (const e of sizingChart.sizing_chart_entries) {
                              if (e.length_mm != null) {
                                const shp = e.shape || "Standard";
                                if (!shapesMap[shp]) shapesMap[shp] = {};
                                shapesMap[shp][e.size_label] = Number(e.length_mm);
                              }
                            }
                          }
                          return Object.entries(shapesMap).map(([shapeName, sizes]) => (
                            <tr key={shapeName} className="hover:bg-accent/20 transition-colors">
                              <td className="py-3 px-4 font-bold font-sans text-foreground whitespace-nowrap">
                                {shapeName}
                              </td>
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                                const val = sizes[`#${num}`] ?? sizes[`${num}`];
                                return (
                                  <td key={num} className="py-3 px-2 text-center text-foreground font-semibold">
                                    {val != null ? `${val} mm` : "—"}
                                  </td>
                                );
                              })}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isShapeRange ? (
                /* FORMAT C: SHAPE-BASED MEASUREMENT SPECIFICATIONS */
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Ruler className="size-3.5 text-lavender-deep" />
                    <span>Physical millimeter bounds per silhouette shape (Length × Width ranges, Thickness)</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border/80">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border/80 bg-accent/30 text-xs font-semibold uppercase text-muted-foreground">
                          <th className="py-3 px-4">Nail Shape</th>
                          <th className="py-3 px-3">Length Min</th>
                          <th className="py-3 px-3">Length Max</th>
                          <th className="py-3 px-3">Width Min</th>
                          <th className="py-3 px-3">Width Max</th>
                          <th className="py-3 px-3">Thickness</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {sizingChart.shape_ranges!.map((sr, idx) => (
                          <tr key={idx} className="hover:bg-accent/20 transition-colors">
                            <td className="py-3 px-4 font-bold font-sans text-foreground">
                              {sr.shape}
                            </td>
                            <td className="py-3 px-3 text-foreground">
                              {sr.length_min_mm != null ? `${Number(sr.length_min_mm).toFixed(2)} mm` : "—"}
                            </td>
                            <td className="py-3 px-3 text-foreground">
                              {sr.length_max_mm != null ? `${Number(sr.length_max_mm).toFixed(2)} mm` : "—"}
                            </td>
                            <td className="py-3 px-3 text-foreground font-semibold">
                              {sr.width_min_mm != null ? `${Number(sr.width_min_mm).toFixed(2)} mm` : "—"}
                            </td>
                            <td className="py-3 px-3 text-foreground font-semibold">
                              {sr.width_max_mm != null ? `${Number(sr.width_max_mm).toFixed(2)} mm` : "—"}
                            </td>
                            <td className="py-3 px-3 text-muted-foreground">
                              {sr.thickness_mm != null ? `${Number(sr.thickness_mm).toFixed(1)} mm` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isNumberedSize ? (
                /* FORMAT B: NUMBERED SIZE CHART (PRESERVES EXACT BRAND ORDERING & RANGES) */
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Ruler className="size-3.5 text-lavender-deep" />
                    <span>Individual tip numbering ordered according to official brand guidelines</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border/80">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border/80 bg-accent/30 text-xs font-semibold uppercase text-muted-foreground">
                          <th className="py-3 px-4">Size Number</th>
                          <th className="py-3 px-3">Tip Width (mm)</th>
                          <th className="py-3 px-3">Typical Hand & Finger Placement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {sizingChart.numbered_sizes!.map((ns, idx) => {
                          const widthDisplay =
                            ns.min_width_mm != null && ns.max_width_mm != null && ns.min_width_mm !== ns.max_width_mm
                              ? `${ns.is_approximate ? "~" : ""}${ns.min_width_mm}–${ns.max_width_mm} mm`
                              : ns.width_mm != null
                              ? `${ns.is_approximate ? "~" : ""}${ns.width_mm} mm`
                              : "—";

                          return (
                            <tr key={idx} className="hover:bg-accent/20 transition-colors">
                              <td className="py-3.5 px-4 font-bold font-sans text-foreground">
                                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground text-xs font-bold">
                                  #{ns.size}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 font-semibold text-foreground">
                                {widthDisplay}
                              </td>
                              <td className="py-3.5 px-3 font-sans text-xs text-muted-foreground">
                                {ns.typical_finger || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isWidthRanges ? (
                /* FORMAT D: NAIL WIDTH RANGES TABLE */
                <div className="mt-6 overflow-x-auto rounded-xl border border-border/80">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-accent/30 text-xs font-semibold uppercase text-muted-foreground">
                        <th className="py-3 px-4">Press-On Size</th>
                        <th className="py-3 px-3">Min Width (mm)</th>
                        <th className="py-3 px-3">Max Width (mm)</th>
                        <th className="py-3 px-3">Width Span</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {sizingChart.ranges!.map((r, i) => (
                        <tr key={i} className="hover:bg-accent/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold font-sans text-foreground">
                            <span className="inline-flex size-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-semibold">
                              {r.sizeLabel}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-medium text-foreground">
                            {r.minMm} mm
                          </td>
                          <td className="py-3.5 px-3 font-medium text-foreground">
                            {r.maxMm} mm
                          </td>
                          <td className="py-3.5 px-3 text-muted-foreground">
                            {(r.maxMm - r.minMm).toFixed(1)} mm
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* FORMAT A: PER-SIZE FINGER MATRIX TABLE (PRESET SET XS/S/M/L) */
                <div className="mt-6 overflow-x-auto rounded-xl border border-border/80">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-accent/30 text-xs font-semibold uppercase text-muted-foreground">
                        <th className="py-3 px-4">Size Set</th>
                        <th className="py-3 px-3">Thumb (mm)</th>
                        <th className="py-3 px-3">Index (mm)</th>
                        <th className="py-3 px-3">Middle (mm)</th>
                        <th className="py-3 px-3">Ring (mm)</th>
                        <th className="py-3 px-3">Pinky (mm)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {sizeKeys.map((sz) => {
                        const fingerData = sizingChart.sizes[sz];
                        return (
                          <tr key={sz} className="hover:bg-accent/20 transition-colors">
                            <td className="py-3.5 px-4 font-bold font-sans text-foreground">
                              <span className="inline-flex size-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-semibold">
                                {sz}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 font-medium text-foreground">{fingerData?.thumb ?? "-"} mm</td>
                            <td className="py-3.5 px-3 font-medium text-foreground">{fingerData?.index ?? "-"} mm</td>
                            <td className="py-3.5 px-3 font-medium text-foreground">{fingerData?.middle ?? "-"} mm</td>
                            <td className="py-3.5 px-3 font-medium text-foreground">{fingerData?.ring ?? "-"} mm</td>
                            <td className="py-3.5 px-3 font-medium text-foreground">{fingerData?.pinky ?? "-"} mm</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Source & Verification Metadata Box */}
              {sizingChart && (
                <div className="mt-6 space-y-3 pt-4 border-t border-border/60">
                  {sizingChart.verification_status === "user_provided" && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-300">
                      <FileText className="size-4 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <strong>User-Provided Sizing Documentation:</strong> Sizing chart specifications were extracted directly from user-supplied official brand charts and measurement guides.
                      </div>
                    </div>
                  )}

                  {sizingChart.verification_status === "verified" && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-300">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                      <div>
                        <strong>Brand Verified:</strong> Specifications verified directly by official brand studio.
                      </div>
                    </div>
                  )}

                  {sizingChart.source_url && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ExternalLink className="size-3.5 text-lavender-deep shrink-0" />
                      <span>
                        Source URL:{" "}
                        <a
                          href={sizingChart.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-lavender-deep hover:underline truncate max-w-sm inline-block align-bottom"
                        >
                          {sizingChart.source_url}
                        </a>
                      </span>
                    </div>
                  )}

                  {sizingChart.source_notes && (
                    <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground border border-border/50 font-sans leading-relaxed">
                      <strong className="text-foreground">Source Notes:</strong> {sizingChart.source_notes}
                    </div>
                  )}
                </div>
              )}

              {sizingChart?.customNotes && (
                <div className="mt-6 rounded-xl bg-accent/20 p-4 text-xs text-muted-foreground border border-border/50">
                  <strong className="text-foreground">Brand Fitting Notes:</strong> {sizingChart.customNotes}
                </div>
              )}
            </div>

            {/* About the Studio */}
            {brand.description && (
              <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
                <h3 className="font-display text-xl font-bold text-foreground">About the Studio</h3>
                <p className="mt-4 text-sm leading-relaxed text-foreground/85">
                  {brand.description}
                </p>

                {brand.shapes && brand.shapes.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Offered Nail Shapes & Silhouettes
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {brand.shapes.map((shp) => (
                        <span
                          key={shp}
                          className="rounded-lg bg-secondary/80 px-3 py-1 text-xs font-medium text-secondary-foreground"
                        >
                          {shp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar: Public Brand Info & Measuring CTA */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-600" />
                <h3 className="font-display text-lg font-bold text-foreground">Brand Information</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                {locationStr && (
                  <div className="flex items-center gap-2.5 text-foreground/80">
                    <MapPin className="size-4 text-muted-foreground shrink-0" />
                    <span>{locationStr}</span>
                  </div>
                )}
                {brand.website && (
                  <div className="flex items-center gap-2.5 text-foreground/80">
                    <Globe className="size-4 text-muted-foreground shrink-0" />
                    <a href={brand.website} target="_blank" rel="noreferrer" className="hover:underline">
                      {brand.website.replace("https://", "")}
                    </a>
                  </div>
                )}
                {brand.instagram && (
                  <div className="flex items-center gap-2.5 text-foreground/80">
                    <Instagram className="size-4 text-muted-foreground shrink-0" />
                    <span>{brand.instagram}</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Size Finder Guest Flow Hook */}
            <div className="rounded-2xl border border-lavender-deep/30 bg-lavender/25 p-6 shadow-soft space-y-4">
              <div className="inline-flex size-10 items-center justify-center rounded-xl bg-lavender-deep/20 text-lavender-deep">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h4 className="font-display text-xl font-bold text-foreground">
                  Get Your Exact Sizes
                </h4>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Guest users can run our free browser AI vision measurement with a ₹10 reference coin to discover their exact millimeter finger widths.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link to={`/ai-nail-size-finder?brand=${encodeURIComponent(brand.slug)}`}>
                  Find My Size (Free Measurement)
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
