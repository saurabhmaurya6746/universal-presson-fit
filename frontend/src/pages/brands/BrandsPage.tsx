import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, ShieldCheck, Search, SlidersHorizontal, Lock, AlertCircle, RefreshCw } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import { publicBrandRepository } from "@/services/publicBrandRepository";
import type { PublicBrandProfile } from "@/types/brand";

export function BrandsPage() {
  const [brands, setBrands] = useState<PublicBrandProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedShape, setSelectedShape] = useState<string>("all");

  const loadBrands = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await publicBrandRepository.getPublicBrands();
      setBrands(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load brand directory.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const allShapes = Array.from(new Set(brands.flatMap((b) => b.shapes)));

  const filteredBrands = brands.filter((brand) => {
    const locationStr = [brand.city, brand.country].filter(Boolean).join(", ");
    const matchesSearch =
      brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (brand.tagline || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      locationStr.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesShape =
      selectedShape === "all" || brand.shapes.includes(selectedShape);

    return matchesSearch && matchesShape;
  });

  const isRemote = publicBrandRepository.isRemoteEnabled();

  return (
    <>
      <SEO
        title="Browse Sample Brands | PressOn Fit"
        description="Browse sample press-on nail studio sizing charts and find your best fit using PressOn Fit's millimeter AI measurement."
      />

      <PageIntro
        eyebrow="Universal Sizing Directory"
        title="Sample Press-On Brand Charts"
      >
        Explore how different press-on studios define their XS, S, M, L dimensions. Any press-on nail brand can host their sizing chart on PressOn Fit.
      </PageIntro>

      {/* Demo / Backend Status Notice */}
      <div className="section-shell pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-foreground">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              {isRemote ? (
                <strong>Live PressOn Fit Catalog:</strong>
              ) : (
                <strong>Sample / Demo Directory (UI Prototype):</strong>
              )}{" "}
              {isRemote
                ? "Connecting to public brand catalog API."
                : "Cloud database is not connected. Brand charts and profiles shown here are sample templates for demonstration and testing."}
            </span>
          </div>
          <Link
            to="/brand/login"
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-lavender-deep hover:underline"
          >
            <Lock className="size-3.5" />
            For Brands Portal (Demo)
          </Link>
        </div>
      </div>

      <section className="section-shell py-12">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <RefreshCw className="size-8 animate-spin text-lavender-deep mb-3" />
            <p className="text-sm font-medium text-foreground">Loading studio directory...</p>
          </div>
        )}

        {/* Error State with explicit Retry Button */}
        {!isLoading && errorMessage && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-8 text-center max-w-lg mx-auto">
            <AlertCircle className="size-8 text-destructive mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-destructive">Failed to Load Brands</h3>
            <p className="mt-2 text-xs text-muted-foreground">{errorMessage}</p>
            <Button onClick={loadBrands} variant="outline" className="mt-5 gap-2" size="sm">
              <RefreshCw className="size-4" />
              Retry Connection
            </Button>
          </div>
        )}

        {!isLoading && !errorMessage && (
          <>
            {/* Search & Filter Controls */}
            <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search brand, shape, city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-lavender-deep/40 transition-all"
                />
              </div>

              {/* Shape Pill Filter */}
              <div className="flex flex-wrap gap-1.5 items-center w-full md:w-auto">
                <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                  <SlidersHorizontal className="size-3" />
                  Shape:
                </span>
                <button
                  onClick={() => setSelectedShape("all")}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    selectedShape === "all"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-card/70 text-muted-foreground hover:text-foreground border border-border/60"
                  }`}
                >
                  All
                </button>
                {allShapes.map((shape) => (
                  <button
                    key={shape}
                    onClick={() => setSelectedShape(shape)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      selectedShape === shape
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-card/70 text-muted-foreground hover:text-foreground border border-border/60"
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Grid */}
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {filteredBrands.map((brand) => {
                const locationStr = [brand.city, brand.country].filter(Boolean).join(", ");
                return (
                  <div
                    key={brand.id}
                    className="group flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-6 shadow-soft transition-all duration-300 hover:shadow-luxe hover:border-lavender-deep/40"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">
                              {brand.name}
                            </h3>
                            <span title="Sanitized Public Profile">
                              <ShieldCheck className="size-4.5 text-muted-foreground shrink-0" />
                            </span>
                          </div>
                          {locationStr && (
                            <p className="mt-1 text-xs font-medium text-muted-foreground">
                              {locationStr}
                            </p>
                          )}
                        </div>
                        <span className="rounded-full bg-lavender/50 px-2.5 py-1 text-[11px] font-semibold text-lavender-deep uppercase tracking-wider">
                          Studio
                        </span>
                      </div>

                      {brand.tagline && (
                        <p className="mt-4 text-sm text-foreground/85 line-clamp-2">
                          {brand.tagline}
                        </p>
                      )}

                      {/* Sizing Chart Preview Badge (if chart available) */}
                      {brand.sizingChart?.sizes && Object.keys(brand.sizingChart.sizes).length > 0 && (
                        <div className="mt-5 rounded-xl bg-accent/30 p-3 border border-border/40">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Sizing Chart</span>
                            <span className="truncate max-w-[150px]">{brand.sizingChart.chartName}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[11px]">
                            {Object.entries(brand.sizingChart.sizes).slice(0, 4).map(([sz, dims]) => (
                              <div key={sz} className="rounded-md bg-background/80 py-1 px-1 border border-border/30">
                                <span className="font-bold text-foreground block">{sz}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {dims.thumb}mm
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Supported Shapes */}
                      {brand.shapes && brand.shapes.length > 0 && (
                        <div className="mt-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Available Shapes
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {brand.shapes.map((shp) => (
                              <span
                                key={shp}
                                className="rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] text-secondary-foreground"
                              >
                                {shp}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between gap-3">
                      <Button asChild variant="outline" size="sm" className="w-full text-xs">
                        <Link to={`/brands/${brand.slug}`}>
                          View Sizing Chart
                        </Link>
                      </Button>
                      <Button asChild size="sm" className="w-full text-xs gap-1">
                        <Link to={`/ai-nail-size-finder?brand=${encodeURIComponent(brand.slug)}`}>
                          <Sparkles className="size-3.5" />
                          Measure Fit
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredBrands.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                No brand partners match your search criteria.
              </div>
            )}
          </>
        )}

        {/* Portal CTA Banner */}
        <div className="mt-16 rounded-3xl bg-lavender/30 border border-lavender-deep/20 p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
              Are you a press-on nail artist or studio?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Access the brand portal to upload your unique sizing chart, configure custom widths, and test customer fit calibrations.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button asChild className="gap-2">
              <Link to="/brand/login">
                For Brands Portal (Demo)
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
