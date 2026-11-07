import { Link } from "react-router-dom";
import {
  Coins,
  Cpu,
  TableProperties,
  AlertTriangle,
  Sparkles,
  Ruler,
} from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";

export function HowSizingWorks() {
  const steps = [
    {
      num: "01",
      icon: Coins,
      title: "Physical Scale Calibration (₹10 Reference Coin)",
      desc: "Every smartphone camera has different focal lengths and distances. To translate pixels into true millimeters without physical tape, we use a genuine ₹10 Indian coin (exact minted diameter of 27.00 mm) as an optical scale standard.",
      highlight: "Coin diameter = 27.00 mm standard",
    },
    {
      num: "02",
      icon: Cpu,
      title: "Computer Vision Nail Segmentation",
      desc: "Client-side AI vision scans your hand photo to locate each natural fingernail bed. It isolates the nail contour and calculates the maximum horizontal transverse width perpendicular to your finger's natural axis.",
      highlight: "In-browser edge AI processing",
    },
    {
      num: "03",
      icon: TableProperties,
      title: "Cross-Brand Sizing Chart Comparison",
      desc: "Different press-on studios craft nails with varying size molds (e.g. Size 'M' is 14mm in one brand but 13mm in another). PressOn Fit takes your exact millimeter measurements and maps them to any brand's chart by choosing the closest size equal to or slightly wider than your natural nail.",
      highlight: "Universal fit across multiple brands",
    },
    {
      num: "04",
      icon: Ruler,
      title: "Tolerance, C-Curve & Fit Approximation",
      desc: "An overhead photo captures a 2D projection of your nail plate. Natural nails possess natural curvature (C-curve). Slight lighting shadows or camera tilt can create an approximation variance of ±0.5 mm.",
      highlight: "Approximate optical estimation",
    },
  ];

  return (
    <>
      <SEO
        title="How Sizing Works | PressOn Fit Universal Sizing"
        description="Learn how PressOn Fit uses optical ₹10 coin calibration and AI computer vision to estimate natural fingernail widths in millimeters for any press-on nail brand."
      />

      <PageIntro
        eyebrow="Measurement Science"
        title="How PressOn Fit Sizing Works"
      >
        Discover how computer vision and optical coin scale calibration translate a smartphone photo into precision millimeter nail widths for any press-on brand.
      </PageIntro>

      {/* Critical Approximation & Disclaimer Notice */}
      <div className="section-shell pt-6">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-foreground">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400">
                Measurement Approximation & Studio Fit Guidance
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Optical AI measurements are an <strong>intelligent approximation</strong> designed to save time. Actual fit can be influenced by natural nail curvature (C-curve), camera angle, coin flatness, and room lighting. We strongly recommend comparing your millimeter results with each specific press-on brand's fitting guide before placing custom orders.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="section-shell py-16">
        <div className="grid gap-8 md:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="flex flex-col justify-between rounded-3xl border border-border bg-card p-8 shadow-soft transition-all hover:shadow-luxe"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl font-bold text-lavender-deep">
                      {step.num}
                    </span>
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-lavender/50 text-lavender-deep">
                      <Icon className="size-6" />
                    </div>
                  </div>
                  <h3 className="mt-6 font-display text-2xl font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-border/60">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-lavender-deep">
                    <Sparkles className="size-3.5" />
                    {step.highlight}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tips for Best Accuracy */}
        <div className="mt-16 rounded-3xl border border-border bg-card p-8 sm:p-12 shadow-soft">
          <div className="max-w-3xl">
            <h3 className="font-display text-3xl font-bold text-foreground">
              Tips for the Most Accurate Optical Measurement
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Follow these simple guidelines when taking your hand photo to achieve optimal millimeter estimation:
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-accent/25 p-5 border border-border/40">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Keep Hand & Coin on the Same Level
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Place both your hand and the ₹10 coin on a flat desk or table. Never place the coin on top of fingers or on an elevated surface.
                </p>
              </div>

              <div className="rounded-2xl bg-accent/25 p-5 border border-border/40">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Shoot Directly Overhead (90°)
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Hold your smartphone camera parallel to the desk surface. Any tilted perspective will foreshorten the coin and nail dimensions.
                </p>
              </div>

              <div className="rounded-2xl bg-accent/25 p-5 border border-border/40">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  3. When in Doubt, Size Up
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  If your measured nail is between two brand sizes (e.g. 14.3 mm between 14 mm XS and 15 mm S), always choose the larger size (15 mm S). A larger press-on can be gently filed to fit, whereas a smaller one will feel uncomfortable.
                </p>
              </div>

              <div className="rounded-2xl bg-accent/25 p-5 border border-border/40">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  4. Independent & Universal
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  PressOn Fit is not tied to any single press-on studio. Your millimeter results belong to you and can be compared with any artisan or retail brand.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-border/60 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="gap-2">
              <Link to="/ai-nail-size-finder">
                <Sparkles className="size-4" />
                Find My Size Now (Free)
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/brands">Browse Sample Brand Charts</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
