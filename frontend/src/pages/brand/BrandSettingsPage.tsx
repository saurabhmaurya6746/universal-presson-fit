import { useState, useEffect } from "react";
import {
  Building2,
  Eye,
  Save,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandPortalLayout } from "@/components/layout/BrandPortalLayout";
import {
  getCurrentBrandUser,
  getBrands,
  getBrandById,
  updateBrandProfile,
  updateBrandPlan,
  updateBrandVisibility,
} from "@/services/brandService";
import { authAdapter } from "@/services/authAdapter";
import { brandApiService, RealBrandProfile } from "@/services/brandApiService";
import type { Brand, BrandPlan } from "@/types/brand";

export function BrandSettingsPage() {
  const isLive = authAdapter.isRemoteEnabled();
  const [realBrand, setRealBrand] = useState<RealBrandProfile | null>(null);

  const currentUser = getCurrentBrandUser();
  const brands = getBrands();
  const activeBrand: Brand =
    (currentUser?.brandId ? getBrandById(currentUser.brandId) : null) || brands[0];

  const [contactPerson, setContactPerson] = useState(
    activeBrand.contactPerson || activeBrand.name + " Manager"
  );
  const [contactEmail, setContactEmail] = useState(activeBrand.contactEmail);
  const [website, setWebsite] = useState(activeBrand.website || "");
  const [instagram, setInstagram] = useState(activeBrand.instagram || "");
  const [tagline, setTagline] = useState(activeBrand.tagline || "");
  const [currentPlan, setCurrentPlan] = useState<BrandPlan>(activeBrand.plan || "starter");
  const [profileVis, setProfileVis] = useState<"public" | "hidden">(
    activeBrand.profileVisibility || "public"
  );
  const [chartVis, setChartVis] = useState<"public" | "hidden">(
    activeBrand.chartVisibility || "public"
  );

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      if (isLive) {
        try {
          const b = await brandApiService.getMyBrand();
          if (mounted && b) {
            setRealBrand(b);
            if (b.contact_person) setContactPerson(b.contact_person);
            if (b.contact_email) setContactEmail(b.contact_email);
            if (b.website) setWebsite(b.website);
            if (b.instagram) setInstagram(b.instagram);
            if (b.tagline) setTagline(b.tagline);
            setProfileVis(b.is_public ? "public" : "hidden");
          }
        } catch (err) {
          console.error("Failed to fetch brand settings:", err);
        }
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, [isLive]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSaveContactDetails = async () => {
    if (isLive) {
      const res = await brandApiService.updateMyBrand({
        contact_person: contactPerson,
        website,
        instagram,
        tagline,
      });
      if (res.success) {
        showToast("Brand contact and studio details saved successfully.");
      } else {
        showToast(res.error || "Failed to update brand profile.");
      }
    } else {
      updateBrandProfile(activeBrand.id, {
        contactPerson,
        contactEmail,
        website,
        instagram,
        tagline,
      });
      showToast("Brand contact details saved to local storage.");
    }
  };

  const handleSelectPlan = (plan: BrandPlan) => {
    setCurrentPlan(plan);
    updateBrandPlan(activeBrand.id, plan);
    showToast(`Brand subscription plan set to ${plan === "studio" ? "Studio" : "Starter"}.`);
  };

  const handleToggleProfileVisibility = (vis: "public" | "hidden") => {
    setProfileVis(vis);
    updateBrandVisibility(activeBrand.id, vis, undefined);
    showToast(`Brand profile visibility set to ${vis.toUpperCase()}.`);
  };

  const handleToggleChartVisibility = (vis: "public" | "hidden") => {
    setChartVis(vis);
    updateBrandVisibility(activeBrand.id, undefined, vis);
    showToast(`Sizing chart visibility set to ${vis.toUpperCase()}.`);
  };

  return (
    <BrandPortalLayout
      brandName={realBrand?.name || activeBrand.name}
      contactName={contactPerson}
      status={realBrand?.status || activeBrand.status}
      brandSlug={realBrand?.slug || activeBrand.slug}
    >
      <div className="space-y-6">
        {toastMessage && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Contact Details Card */}
        <div id="profile" className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-foreground" />
              <h3 className="text-base font-bold text-foreground">Studio Contact & Profile</h3>
            </div>
            <Button size="sm" onClick={handleSaveContactDetails} className="h-7 text-xs font-semibold gap-1">
              <Save className="size-3.5" />
              Save Details
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                Brand Studio Name
              </label>
              <input
                type="text"
                disabled
                value={realBrand?.name || activeBrand.name}
                className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-foreground font-semibold outline-none cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-foreground font-medium outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-foreground font-medium outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                Contact Email
              </label>
              <input
                type="email"
                disabled={isLive}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-foreground font-medium outline-none focus:border-primary disabled:bg-muted/40 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                Instagram Handle
              </label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@yourbrand"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-foreground font-medium outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                Website URL
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourbrand.com"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-foreground font-medium outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Visibility Controls Card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-2xs">
          <div className="flex items-center gap-2 pb-3 border-b border-border/60">
            <Eye className="size-4 text-foreground" />
            <h3 className="text-base font-bold text-foreground">Public Visibility Controls</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-muted/20">
              <div>
                <span className="font-bold text-foreground block">Brand Public Profile</span>
                <span className="text-[11px] text-muted-foreground">
                  When public, approved brands are listed in the PressOn Fit Brand Directory.
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant={profileVis === "public" ? "default" : "outline"}
                  onClick={() => handleToggleProfileVisibility("public")}
                  className="h-7 text-xs font-semibold px-3"
                >
                  Public
                </Button>
                <Button
                  size="sm"
                  variant={profileVis === "hidden" ? "default" : "outline"}
                  onClick={() => handleToggleProfileVisibility("hidden")}
                  className="h-7 text-xs font-semibold px-3"
                >
                  Hidden
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-muted/20">
              <div>
                <span className="font-bold text-foreground block">Sizing Chart Discoverability</span>
                <span className="text-[11px] text-muted-foreground">
                  Enable or disable customer optical coin fitting against your brand.
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant={chartVis === "public" ? "default" : "outline"}
                  onClick={() => handleToggleChartVisibility("public")}
                  className="h-7 text-xs font-semibold px-3"
                >
                  Enabled
                </Button>
                <Button
                  size="sm"
                  variant={chartVis === "hidden" ? "default" : "outline"}
                  onClick={() => handleToggleChartVisibility("hidden")}
                  className="h-7 text-xs font-semibold px-3"
                >
                  Disabled
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Plan Card */}
        <div id="plan" className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-2xs">
          <div className="pb-3 border-b border-border/60">
            <h3 className="text-base font-bold text-foreground">Studio Subscription Tier</h3>
            <p className="text-xs text-muted-foreground">
              Select your studio volume and size-matching allowance.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => handleSelectPlan("starter")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                currentPlan === "starter"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border bg-card hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <h4 className="font-bold text-sm text-foreground">Single Studio</h4>
                {currentPlan === "starter" && (
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
                    Active Plan
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground">₹249 / month</p>
              <p className="text-[11px] text-muted-foreground mt-2">
                Ideal for independent nail artists. Includes 1 sizing chart, unlimited AI customer matches, and directory listing.
              </p>
            </div>

            <div
              onClick={() => handleSelectPlan("studio")}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                currentPlan === "studio"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border bg-card hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <h4 className="font-bold text-sm text-foreground">Multi-Salon Pro</h4>
                {currentPlan === "studio" && (
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
                    Active Plan
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground">₹399 / month</p>
              <p className="text-[11px] text-muted-foreground mt-2">
                For established press-on brands. Includes multiple chart lines, custom notes, analytics, and priority placement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </BrandPortalLayout>
  );
}

export default BrandSettingsPage;
