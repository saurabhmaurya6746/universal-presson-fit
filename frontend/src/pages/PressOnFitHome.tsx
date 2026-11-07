import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import { getBrands } from "@/services/brandService";
import heroNails from "@/assets/images/hero-nails.jpg";

export function PressOnFitHome() {
  const sampleBrands = getBrands().slice(0, 3);

  const steps = [
    {
      num: "01",
      title: "Place a ₹10 coin beside your hand",
      desc: "Place a genuine ₹10 Indian coin flat on an even desk surface next to your fingers. The known 27.0 mm coin diameter provides the physical scale.",
    },
    {
      num: "02",
      title: "Take an overhead photo",
      desc: "Capture a clear photo from directly above (90° angle) in even lighting, ensuring all fingernails and the entire coin are visible.",
    },
    {
      num: "03",
      title: "Estimate nail widths in millimeters",
      desc: "In-browser computer vision detects your nail boundaries and estimates horizontal width in millimeters for each finger.",
    },
    {
      num: "04",
      title: "Compare with any brand's size chart",
      desc: "Check your millimeter measurements against sizing charts from different press-on studios to find your closest matching size.",
    },
  ];

  const valueProps = [
    {
      title: "Universal millimeter widths",
      desc: "Get width estimates in millimeters rather than relying on inconsistent sizing labels across different sellers.",
    },
    {
      title: "Per-finger results",
      desc: "View individual estimated widths for thumb, index, middle, ring, and pinky to accommodate asymmetrical hands.",
    },
    {
      title: "Brand chart comparison",
      desc: "Compare your measured millimeters with published press-on size charts without buying separate physical sizing kits.",
    },
    {
      title: "No account required",
      desc: "Start measuring immediately as a guest. All photo processing runs locally in your browser for privacy.",
    },
  ];

  return (
    <>
      <SEO
        title="PressOn Fit | Universal Press-On Nail Sizing"
        description="Estimate your natural fingernail widths in millimeters using a hand photo and a ₹10 reference coin. Compare measurements with any press-on nail brand."
      />

      {/* 1. Hero Section */}
      <section className="border-b border-border bg-background py-16 md:py-24">
        <div className="section-shell grid items-center gap-12 lg:grid-cols-2">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Press-on nail sizing
            </p>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
              Your Natural Nail Widths, Measured.
            </h1>

            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
              Find your press-on nail size using a clear hand photo and a standard ₹10 reference coin. Estimate your natural nail widths in millimeters, then compare with any brand's sizing chart.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild className="gap-2">
                <Link to="/ai-nail-size-finder">
                  Measure My Nails
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/brands">Browse Brands</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
                <Link to="/how-sizing-works">How It Works</Link>
              </Button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Free to use · No account required · In-browser processing
            </p>
          </div>

          {/* Hero Visual */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <img
                src={heroNails}
                alt="Natural hand resting on table for nail measurement"
                className="aspect-[4/3.5] w-full object-cover object-center"
              />
              <div className="p-4 border-t border-border bg-card text-xs flex items-center justify-between">
                <div>
                  <span className="font-semibold text-foreground block">
                    Example estimation: Index 12.8 mm
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    Illustrative sample · Actual results depend on photo quality
                  </span>
                </div>
                <span className="text-muted-foreground text-[11px] font-mono">
                  Scale: ₹10 coin
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How It Works Section */}
      <section className="section-shell py-16 md:py-20 border-b border-border">
        <div className="mb-12 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-foreground">
            Four simple steps to find your size
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            An authentic coin provides an optical scale standard for camera distance calibration.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div
              key={step.num}
              className="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between nail-card-lift"
            >
              <div>
                <span className="font-mono text-sm font-bold text-muted-foreground block mb-3">
                  {step.num}
                </span>
                <h3 className="font-display text-lg font-bold text-foreground leading-snug">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link
            to="/how-sizing-works"
            className="text-xs font-semibold text-foreground hover:underline inline-flex items-center gap-1"
          >
            <span>Read full measurement guidance and curvature considerations</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* 3. Why PressOn Fit Section */}
      <section className="section-shell py-16 md:py-20 border-b border-border">
        <div className="mb-12 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Why PressOn Fit
          </p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-foreground">
            Universal sizing for any press-on brand
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Measure once in millimeters. Compare with sizing standards from different nail artists.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {valueProps.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-border bg-card p-6 shadow-xs"
            >
              <h3 className="font-display text-xl font-bold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Brand Catalog Preview */}
      <section className="section-shell py-16 md:py-20 border-b border-border">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Brand Catalog
              </p>
              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Sample data
              </span>
            </div>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-foreground">
              Sample press-on brand charts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              See how different studios structure their XS, S, M, L dimensions.
            </p>
          </div>

          <Button variant="outline" asChild size="sm" className="shrink-0">
            <Link to="/brands">
              Browse All Brands <ChevronRight className="size-4 ml-1" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sampleBrands.map((brand) => (
            <div
              key={brand.id}
              className="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between nail-card-lift"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl font-bold text-foreground">
                      {brand.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{brand.location}</p>
                  </div>
                  <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    Sample
                  </span>
                </div>

                <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
                  {brand.tagline}
                </p>

                {/* Sizing Chart Preview */}
                <div className="mt-4 rounded-lg bg-accent/30 p-3 border border-border/50 text-xs">
                  <span className="text-[11px] font-semibold text-foreground block mb-1">
                    {brand.sizingChart.chartName}
                  </span>
                  <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-mono">
                    {Object.entries(brand.sizingChart.sizes).map(([sz, dims]) => (
                      <div key={sz} className="rounded bg-background p-1 border border-border/30">
                        <span className="font-bold text-foreground block">{sz}</span>
                        <span className="text-muted-foreground">{dims.thumb}mm</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-border flex flex-col gap-2">
                <Button size="sm" asChild variant="outline" className="w-full text-xs">
                  <Link to={`/brands/${brand.slug}`}>View Size Chart</Link>
                </Button>
                <Button size="sm" asChild className="w-full text-xs">
                  <Link to={`/ai-nail-size-finder?brand=${encodeURIComponent(brand.slug)}`}>
                    Measure for this Brand
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Brand Partner CTA */}
      <section className="section-shell py-14 border-b border-border">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block">
              For Press-on Sellers
            </span>
            <h3 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-foreground">
              Are you a press-on nail studio or seller?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Explore our demo portal for uploading your sizing chart. Note: data is currently saved locally in your browser; online account sync is in progress.
            </p>
          </div>

          <Button asChild className="shrink-0 text-xs font-semibold">
            <Link to="/brand/login">For Brands · Demo</Link>
          </Button>
        </div>
      </section>

      {/* 6. Closing CTA */}
      <section className="section-shell py-16 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
            Ready when your hand is?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Grab a standard ₹10 coin and estimate your fingernail millimeter widths in under two minutes.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/ai-nail-size-finder">Measure My Nails</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free to use · No login or account required
          </p>
        </div>
      </section>
    </>
  );
}
