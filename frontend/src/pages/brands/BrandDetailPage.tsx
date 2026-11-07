import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Sparkles, ShieldCheck, Globe, Instagram, MapPin, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
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
  const isWidthRanges =
    sizingChart?.format === "width_ranges" &&
    Boolean(sizingChart.ranges && sizingChart.ranges.length > 0);
  const sizeKeys = sizingChart ? Object.keys(sizingChart.sizes || {}) : [];
  const locationStr = [brand.city, brand.country].filter(Boolean).join(", ");

  return (
    <>
      <SEO
        title={`${brand.name} | Sizing Chart | PressOn Fit`}
        description={`View ${brand.name} press-on sizing specifications and millimeter finger width recommendations on PressOn Fit.`}
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

      <PageIntro
        eyebrow="Studio Sizing Profile"
        title={brand.name}
      >
        {brand.tagline || ""}
      </PageIntro>

      {/* Demo / Status Notice */}
      <div className="section-shell">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-foreground flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              {isRemote ? (
                <strong>Live PressOn Fit View:</strong>
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
              ) : isWidthRanges ? (
                /* FORMAT B: NAIL WIDTH RANGES TABLE */
                <div className="mt-6 overflow-x-auto">
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
                /* FORMAT A: PER-SIZE FINGER MATRIX TABLE */
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-accent/30 text-xs font-semibold uppercase text-muted-foreground">
                        <th className="py-3 px-4">Size Code</th>
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
