import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Edit,
  Clock,
  Sparkles,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandPortalLayout } from "@/components/layout/BrandPortalLayout";
import { getBrands, getBrandById } from "@/services/brandService";
import { getCurrentUser } from "@/services/authService";
import { authAdapter } from "@/services/authAdapter";
import {
  brandApiService,
  RealBrandProfile,
  DbSizingChart,
} from "@/services/brandApiService";
import type { Brand } from "@/types/brand";
import { getBrandPortalPath } from "@/services/authService";

export function BrandDashboardPage() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [realBrand, setRealBrand] = useState<RealBrandProfile | null>(null);
  const [charts, setCharts] = useState<DbSizingChart[]>([]);
  const isLiveMode = authAdapter.isRemoteEnabled();

  const demoBrands = getBrands();

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      if (isLiveMode) {
        try {
          const user = await authAdapter.getCurrentUser();
          if (mounted && user) {
            setCurrentUser(user);
          }
          const [b, c] = await Promise.all([
            brandApiService.getMyBrand(),
            brandApiService.getMyCharts(),
          ]);
          if (mounted) {
            setRealBrand(b);
            setCharts(c);
          }
        } catch (err) {
          console.error("Failed to load brand studio details:", err);
        }
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [isLiveMode]);

  // Demo fallback
  const demoBrand: Brand = useMemo(() => {
    if (currentUser?.brandId) {
      const found = getBrandById(currentUser.brandId);
      if (found) return found;
    }
    return demoBrands[0];
  }, [currentUser, demoBrands]);

  const activeBrandName = isLiveMode ? realBrand?.name || currentUser?.brandName || "Brand Studio" : demoBrand.name;
  const activeContactPerson = isLiveMode ? realBrand?.contact_person || currentUser?.name : demoBrand.contactPerson;
  const activeStatus = isLiveMode ? realBrand?.status || "pending_review" : demoBrand.status;
  const activeSlug = isLiveMode ? realBrand?.slug : demoBrand.slug;

  // Real Trial calculations from PostgreSQL `brand_trials` row
  const trialDetails = useMemo(() => {
    if (isLiveMode && realBrand?.trial) {
      const t = realBrand.trial;
      const endMs = new Date(t.end_date).getTime();
      const nowMs = Date.now();
      const diffMs = endMs - nowMs;
      const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const endDateFormatted = new Date(t.end_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return {
        hasTrial: true,
        daysLeft,
        isExpired: daysLeft <= 0 || t.status === "expired",
        endDateFormatted,
        plan: t.selected_plan || "Single Studio",
        status: t.status,
      };
    }
    return {
      hasTrial: false,
      daysLeft: 10,
      isExpired: false,
      endDateFormatted: "10-day evaluation",
      plan: "Single Studio",
      status: "active",
    };
  }, [isLiveMode, realBrand]);

  const activeDbChart = charts.length > 0 ? charts[0] : null;
  const publishedCount = charts.filter((c) => c.status === "published").length;
  const draftCount = charts.filter((c) => c.status === "draft").length;

  return (
    <BrandPortalLayout
      brandName={activeBrandName}
      contactName={activeContactPerson}
      status={activeStatus}
      brandSlug={activeSlug}
    >
      <div className="space-y-6">
        {/* Pending Review Alert Banner */}
        {activeStatus === "pending_review" && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-foreground space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-5 shrink-0" />
              <span>Brand Application Under Review</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your studio partner application for <strong>{activeBrandName}</strong> has been received and is currently under review by our admin team.
              You have full access to configure, import, and test your sizing charts below. Once approved, your studio profile and published charts will immediately become visible to customers.
            </p>
          </div>
        )}

        {/* Primary Next Action Card */}
        {charts.length === 0 ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                <Sparkles className="size-3.5" />
                Recommended Next Step
              </div>
              <h3 className="text-xl font-bold text-foreground">
                Create Your First Sizing Chart
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nail World needs your nail sizing chart to automatically recommend sizes to customers based on their 10-rupee optical coin scan. Choose between Format A (individual finger widths) or Format B (width ranges).
              </p>
            </div>
            <Button asChild size="lg" className="gap-2 shrink-0 text-xs font-bold">
              <Link to={getBrandPortalPath(currentUser?.brandId, "charts")}>
                <Plus className="size-4" />
                Create Sizing Chart
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Total Charts
              </span>
              <p className="text-2xl font-bold text-foreground">{charts.length}</p>
              <span className="text-[11px] text-muted-foreground">Configured in Studio</span>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Published
              </span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {publishedCount}
              </p>
              <span className="text-[11px] text-muted-foreground">Available to Match</span>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Drafts
              </span>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {draftCount}
              </p>
              <span className="text-[11px] text-muted-foreground">Private & In-Progress</span>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Active Format
              </span>
              <p className="text-sm font-bold text-foreground pt-1.5 truncate">
                {activeDbChart?.format === "width_ranges" ? "Format B (Ranges)" : "Format A (Fingers)"}
              </p>
              <span className="text-[11px] text-muted-foreground">Standard mm calibration</span>
            </div>
          </div>
        )}

        {/* Top Area: Active Chart Summary + Studio Trial Status */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Studio Profile & Chart Summary (2 cols) */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {activeDbChart ? activeDbChart.chart_name : "Default Sizing Specifications"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Format: {activeDbChart?.format === "width_ranges" ? "Format B (Width Ranges)" : "Format A (Per-Size Individual Fingers)"} • Unit: Millimeters (mm)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="outline" className="text-xs gap-1.5">
                    <Link to={getBrandPortalPath(currentUser?.brandId, "charts")}>
                      <Edit className="size-3.5" />
                      Manage Size Charts
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Chart Preview Table */}
              <div className="mt-5 overflow-x-auto">
                {activeDbChart && activeDbChart.sizing_chart_entries && activeDbChart.sizing_chart_entries.length > 0 ? (
                  activeDbChart.format === "width_ranges" ? (
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 font-sans font-semibold text-muted-foreground uppercase text-[10px]">
                          <th className="py-2 px-3">Size Label</th>
                          <th className="py-2 px-3">Min Width</th>
                          <th className="py-2 px-3">Max Width</th>
                          <th className="py-2 px-3">Span</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {activeDbChart.sizing_chart_entries.map((r, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3 font-bold font-sans">{r.size_label}</td>
                            <td className="py-2 px-3">{r.min_width_mm} mm</td>
                            <td className="py-2 px-3">{r.max_width_mm} mm</td>
                            <td className="py-2 px-3 text-muted-foreground">
                              {r.min_width_mm && r.max_width_mm ? (r.max_width_mm - r.min_width_mm).toFixed(1) : 0} mm
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 font-sans font-semibold text-muted-foreground uppercase text-[10px]">
                          <th className="py-2 px-3">Size</th>
                          <th className="py-2 px-3">Thumb</th>
                          <th className="py-2 px-3">Index</th>
                          <th className="py-2 px-3">Middle</th>
                          <th className="py-2 px-3">Ring</th>
                          <th className="py-2 px-3">Pinky</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {activeDbChart.sizing_chart_entries.map((entry) => (
                          <tr key={entry.size_label}>
                            <td className="py-2 px-3 font-bold font-sans">{entry.size_label}</td>
                            <td className="py-2 px-3">{entry.thumb_width_mm} mm</td>
                            <td className="py-2 px-3">{entry.index_width_mm} mm</td>
                            <td className="py-2 px-3">{entry.middle_width_mm} mm</td>
                            <td className="py-2 px-3">{entry.ring_width_mm} mm</td>
                            <td className="py-2 px-3">{entry.pinky_width_mm} mm</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : (
                  <div className="py-10 text-center space-y-2">
                    <FileSpreadsheet className="size-8 mx-auto text-muted-foreground opacity-50" />
                    <p className="text-xs font-semibold text-foreground">No sizing chart configured yet.</p>
                    <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                      Calibrate individual finger millimeter dimensions to enable automated customer sizing.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Real Trial & Subscription Status (1 col) */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between shadow-2xs space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Partner Evaluation
                </span>
                <span className="rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5">
                  10-Day Evaluation
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <Clock className="size-5 text-foreground" />
                  <h4 className="text-xl font-bold text-foreground">
                    {trialDetails.isExpired ? (
                      <span className="text-destructive">Trial Concluded</span>
                    ) : (
                      <span>{trialDetails.daysLeft} {trialDetails.daysLeft === 1 ? "day" : "days"} remaining</span>
                    )}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active until {trialDetails.endDateFormatted}. Initialized upon registration.
                </p>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/60 text-[11px] text-muted-foreground leading-relaxed space-y-1">
                <strong className="text-foreground block">Evaluation Notice:</strong>
                <p>
                  During the evaluation period, you can create and manage unlimited sizing charts. Sizing algorithms remain functional throughout testing.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Selected Plan:</span>
              <span className="font-semibold text-foreground">{trialDetails.plan}</span>
            </div>
          </div>
        </div>

        {/* Informational Guidance Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-2">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Automated Customer Size Matching
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When a customer completes a hand scan using the optical ₹10 coin reference, their millimeter fingertip measurements are matched against your published sizing charts. The closest safe fit is recommended automatically.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-2">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Supported Sizing Formats
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Format A:</strong> Individual finger widths in millimeters for each standard size (XS, S, M, L).<br />
              <strong>Format B:</strong> Continuous minimum and maximum width ranges for press-on tips (0–9).
            </p>
          </div>
        </div>
      </div>
    </BrandPortalLayout>
  );
}

export default BrandDashboardPage;
