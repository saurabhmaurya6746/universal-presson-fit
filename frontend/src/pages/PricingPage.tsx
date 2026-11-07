import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Sparkles,
  User,
  Info,
  ChevronDown,
} from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: "Is measuring my nails free for customers?",
    a: "Yes, 100% free forever. Customers can measure their natural nails in millimeters using our optical ₹10 coin calibration anytime without paying or needing a subscription.",
  },
  {
    q: "What does the 10-day brand trial include?",
    a: "Every new brand studio receives a 10-day full access demo trial. You can create your sizing chart (in Format A or Format B), customize your studio profile, and test customer fit recommendations.",
  },
  {
    q: "What happens after the 10-day trial ends?",
    a: "Your studio account safely converts to view-only mode. Your sizing chart data and measurements are never deleted. Active customer matching pauses until plan renewal is confirmed.",
  },
  {
    q: "Why are prices marked as 'To be announced'?",
    a: "PressOn Fit is currently in demo prototype phase. Payment gateways and cloud billing are not yet connected, so all trial and plan selection states are simulated locally in browser storage.",
  },
  {
    q: "Can a brand switch between Starter and Studio plans?",
    a: "Yes. From your Brand Studio Settings or Dashboard, you can toggle between Starter and Studio tiers anytime to evaluate the different features.",
  },
];

export function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <>
      <SEO
        title="Pricing & Plans | PressOn Fit"
        description="Simple, transparent plans for customers and press-on nail studios. Free AI sizing for shoppers and 10-day free trial for brands."
      />

      <PageIntro
        eyebrow="Transparent Sizing Platform"
        title="Plans for Shoppers & Press-On Studios"
      >
        Customers measure for free forever. Press-on studios get a 10-day free trial with no credit card required.
      </PageIntro>

      {/* Honest Demo State Notice */}
      <div className="section-shell pt-4">
        <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground">
          <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-foreground">Prototype Evaluation Notice:</strong> Cloud billing and payment gateway integration are not connected. Plan selection and 10-day trials are demonstrated via local storage state.
          </div>
        </div>
      </div>

      {/* Customer Free Tier Banner */}
      <section className="section-shell py-8">
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/5 via-card to-secondary/30 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold px-3 py-1 uppercase tracking-wider">
              <User className="size-3.5" />
              For Shoppers & Press-On Fans
            </span>
            <h3 className="text-2xl font-bold text-foreground">
              Always Free for Customers
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Measure your natural nails in millimeter precision with optical ₹10 coin calibration. Compare against any partner brand chart at zero cost, with or without creating an account.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
            <Button asChild size="lg" className="w-full sm:w-auto gap-2">
              <Link to="/ai-nail-size-finder">
                <Sparkles className="size-4" />
                Measure My Nails (Free)
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Brand Studio 2-Plan Comparison */}
      <section className="section-shell py-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            For Nail Artists & Studios
          </span>
          <h2 className="text-3xl font-bold text-foreground">
            Two Simple Studio Plans
          </h2>
          <p className="text-sm text-muted-foreground">
            Host your sizing chart on PressOn Fit and let customers match their millimeter measurements directly to your sets.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
          {/* STARTER PLAN - SINGLE SALON */}
          <div className="rounded-3xl border border-border bg-card p-8 flex flex-col justify-between shadow-xs hover:border-foreground/20 transition-all">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-foreground">Single Studio</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    For independent nail artists & single-outlet salons
                  </p>
                </div>
                <span className="rounded-full bg-secondary text-secondary-foreground text-xs font-bold px-3 py-1">
                  10-Day Free Trial
                </span>
              </div>

              <div className="space-y-1 pt-2 border-t border-border/60">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-foreground">₹249</span>
                  <span className="text-xs font-semibold text-muted-foreground">/ month</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Billed monthly · 10-day free trial included, cancel anytime
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-border/60">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                  All Core Sizing Features Included:
                </span>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>1 Brand Sizing Chart</strong> (Format A fingers or Format B width ranges)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Verified Studio Profile</strong> in PressOn Fit Brand Directory</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Millimeter Size Matching</strong> with optical ₹10 coin calibration</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Interactive visual chart editor + bulk CSV sheet upload</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Post-trial view-only archive (measurements & data permanently saved)</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <Button asChild variant="outline" className="w-full text-xs font-bold h-11">
                <Link to="/register">
                  Start 10-Day Free Trial (₹249/mo)
                </Link>
              </Button>
            </div>
          </div>

          {/* STUDIO PRO PLAN - MULTI SALON */}
          <div className="relative rounded-3xl border-2 border-primary bg-card p-8 flex flex-col justify-between shadow-soft">
            <div className="absolute -top-3.5 right-8">
              <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 uppercase tracking-wider shadow-xs">
                Multi-Salon & Chains
              </span>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-foreground">Multi-Salon Pro</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    For multi-location salon chains & bespoke ateliers
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 text-primary text-xs font-bold px-3 py-1">
                  Full Pro Suite
                </span>
              </div>

              <div className="space-y-1 pt-2 border-t border-border/60">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-foreground">₹399</span>
                  <span className="text-xs font-semibold text-muted-foreground">/ month</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Billed monthly · Multi-branch access & priority support
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-border/60">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                  Everything in ₹249 Plan, plus Multi-Location Power:
                </span>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Multi-Salon / Branch Network:</strong> Showcase multiple salon outlets</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Multiple Chart Systems & Shapes:</strong> Format A & Format B across lines</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Full Studio Nail Art Showcase:</strong> Custom silhouette & shape gallery</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Privacy Controls:</strong> Toggle profile & individual charts Public or Hidden</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Verified Badge:</strong> Priority optical calibration verification</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    <span>Dedicated salon partner onboarding & CSV/PDF export</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <Button asChild className="w-full text-xs font-bold h-11 bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/register">
                  Start Multi-Salon Trial (₹399/mo)
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Matrix */}
      <section className="section-shell py-8">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-xs space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-foreground">
              Feature Comparison
            </h3>
            <p className="text-xs text-muted-foreground">
              Detailed breakdown of platform capabilities across account tiers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-3 px-4">Platform Feature</th>
                  <th className="py-3 px-4 text-center">Shopper (Free)</th>
                  <th className="py-3 px-4 text-center">Single Studio (₹249/mo)</th>
                  <th className="py-3 px-4 text-center font-bold text-foreground">Multi-Salon Pro (₹399/mo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                <tr className="hover:bg-muted/15">
                  <td className="py-3.5 px-4 font-medium text-foreground">AI Millimeter Sizing Engine</td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr className="hover:bg-muted/15">
                  <td className="py-3.5 px-4 font-medium text-foreground">₹10 Coin Optical Calibration</td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr className="hover:bg-muted/15">
                  <td className="py-3.5 px-4 font-medium text-foreground">Brand Sizing Charts Hosted</td>
                  <td className="py-3.5 px-4 text-center text-muted-foreground">—</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-foreground">1 Standard Chart</td>
                  <td className="py-3.5 px-4 text-center font-bold text-foreground">Multiple Systems</td>
                </tr>
                <tr className="hover:bg-muted/15">
                  <td className="py-3.5 px-4 font-medium text-foreground">Format A (Per-Size Fingers)</td>
                  <td className="py-3.5 px-4 text-center text-muted-foreground">—</td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr className="hover:bg-muted/15">
                  <td className="py-3.5 px-4 font-medium text-foreground">Format B (Width Ranges)</td>
                  <td className="py-3.5 px-4 text-center text-muted-foreground">—</td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                </tr>
                <tr className="hover:bg-muted/15">
                  <td className="py-3.5 px-4 font-medium text-foreground">Multi-Salon / Branch Network Listing</td>
                  <td className="py-3.5 px-4 text-center text-muted-foreground">—</td>
                  <td className="py-3.5 px-4 text-center text-muted-foreground">Single Outlet</td>
                  <td className="py-3.5 px-4 text-center font-bold text-foreground">Unlimited Branches</td>
                </tr>
                <tr className="hover:bg-muted/15">
                  <td className="py-3.5 px-4 font-medium text-foreground">Public Directory Listing</td>
                  <td className="py-3.5 px-4 text-center text-muted-foreground">—</td>
                  <td className="py-3.5 px-4 text-center font-medium">Standard Profile</td>
                  <td className="py-3.5 px-4 text-center font-bold text-foreground">Featured Showcase</td>
                </tr>
                <tr className="hover:bg-muted/15">
                  <td className="py-3.5 px-4 font-medium text-foreground">Profile & Chart Privacy Controls</td>
                  <td className="py-3.5 px-4 text-center text-muted-foreground">—</td>
                  <td className="py-3.5 px-4 text-center text-muted-foreground">Standard</td>
                  <td className="py-3.5 px-4 text-center font-bold text-foreground">Public / Hidden Toggles</td>
                </tr>
                <tr className="hover:bg-muted/15">
                  <td className="py-3.5 px-4 font-medium text-foreground">CSV & Sheet Data Export</td>
                  <td className="py-3.5 px-4 text-center text-muted-foreground">—</td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="size-4 text-emerald-600 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="section-shell py-8 pb-16">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-foreground">
              Frequently Asked Questions
            </h3>
            <p className="text-xs text-muted-foreground">
              Got questions about our pricing and trial structure?
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-card overflow-hidden transition-all shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-foreground cursor-pointer hover:bg-muted/20"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`size-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

export default PricingPage;
