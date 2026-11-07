import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { adminApiService } from "@/services/adminApiService";
import {
  ShieldCheck,
  Building2,
  Table,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Info,
  Search,
  ExternalLink,
  Layers,
  X,
  RotateCw,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import {
  getBrands,
  updateBrandStatus,
  extendBrandTrial,
  updateBrandRenewalIntent,
  recordRenewalInquiry,
  updateAdminNotes,
  updateBrandDates,
  renewBrandTrial,
  updateBrandPlan,
  updateBrandVisibility,
} from "@/services/brandService";
import type { Brand, RenewalIntent, BrandPlan } from "@/types/brand";

type FilterTab = "all" | "pending" | "active" | "ending_soon" | "expired" | "renewal_pending";

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

export function AdminPreviewPage() {
  const { user } = useAuthUser();
  const [brands, setBrands] = useState<Brand[]>(() => getBrands());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [adminNotesText, setAdminNotesText] = useState("");

  // Edit Dates state
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  // Renew modal state
  const [renewTargetBrand, setRenewTargetBrand] = useState<Brand | null>(null);
  const [renewStartOption, setRenewStartOption] = useState<"previous_end" | "today">("previous_end");
  const [renewDaysCount, setRenewDaysCount] = useState<number>(10);

  const refreshBrands = async () => {
    if (user && !user.isDemoSession && user.role === "admin") {
      const apiBrands = await adminApiService.listBrands();
      if (apiBrands.length > 0) {
        const demoBrands = getBrands();
        const mapped: Brand[] = apiBrands.map((b) => {
          const match = demoBrands.find((d) => d.id === b.id || d.slug === b.slug);
          return {
            id: b.id,
            name: b.name,
            slug: b.slug,
            tagline: b.tagline || match?.tagline || "",
            description: b.description || match?.description || "",
            contactPerson: b.contact_person || match?.contactPerson || "Studio Contact",
            contactEmail: b.contact_email,
            location: [b.city, b.country].filter(Boolean).join(", ") || match?.location || "India",
            website: b.website || match?.website || "",
            instagram: b.instagram || match?.instagram || "",
            status: b.status,
            shapes: b.shapes || match?.shapes || ["Almond", "Coffin"],
            trialStartDate: b.trial?.start_date || match?.trialStartDate,
            trialEndDate: b.trial?.end_date || match?.trialEndDate,
            trialDurationDays: 10,
            renewalIntent: (b.trial?.renewal_intent as any) || match?.renewalIntent || "not_asked",
            plan: (b.trial?.selected_plan === "studio" ? "studio" : match?.plan || "starter") as BrandPlan,
            isDemo: false,
            profileVisibility: b.is_public ? "public" : "hidden",
            chartVisibility: b.is_public ? "public" : "hidden",
            adminNotes: match?.adminNotes || "",
            sizingChart: match?.sizingChart || {
              id: `chart-${b.id}`,
              brandId: b.id,
              chartName: `${b.name} Standard Chart`,
              unit: "mm",
              updatedDate: new Date().toISOString().split("T")[0],
              format: "width_ranges",
              ranges: [],
              sizes: {},
              sourceType: "manual",
            },
          };
        });
        setBrands(mapped);
        return;
      }
    }

    const updated = getBrands();
    setBrands(updated);
    if (selectedBrand) {
      const refreshedSelected = updated.find((b) => b.id === selectedBrand.id);
      if (refreshedSelected) {
        setSelectedBrand(refreshedSelected);
        setAdminNotesText(refreshedSelected.adminNotes || "");
        setEditStartDate(
          refreshedSelected.trialStartDate
            ? refreshedSelected.trialStartDate.split("T")[0]
            : ""
        );
        setEditEndDate(
          refreshedSelected.trialEndDate
            ? refreshedSelected.trialEndDate.split("T")[0]
            : ""
        );
      }
    }
  };

  useEffect(() => {
    void refreshBrands();
  }, [user]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenBrandDetails = (brand: Brand) => {
    setSelectedBrand(brand);
    setAdminNotesText(brand.adminNotes || "");
    setEditStartDate(brand.trialStartDate ? brand.trialStartDate.split("T")[0] : "");
    setEditEndDate(brand.trialEndDate ? brand.trialEndDate.split("T")[0] : "");
  };

  const handleSaveTrialDates = async () => {
    if (!selectedBrand) return;
    if (!editStartDate || !editEndDate) {
      showToast("Please enter both start and end dates.");
      return;
    }
    const startIso = new Date(editStartDate).toISOString();
    const endIso = new Date(editEndDate).toISOString();
    if (user && !user.isDemoSession) {
      await adminApiService.updateTrial(selectedBrand.id, { end_date: endIso });
    } else {
      updateBrandDates(selectedBrand.id, startIso, endIso);
    }
    await refreshBrands();
    showToast("Trial start and end dates updated successfully.");
  };

  const handleExtendTrial = (brandId: string, days: number) => {
    const res = extendBrandTrial(brandId, days);
    if (res.success) {
      refreshBrands();
      showToast(`Trial extended by +${days} days (${res.daysLeft} days remaining).`);
    }
  };

  const handleOpenRenewDialog = (brand: Brand) => {
    const { isExpired } = getTrialDetails(brand.trialEndDate);
    setRenewStartOption(isExpired ? "today" : "previous_end");
    setRenewDaysCount(10);
    setRenewTargetBrand(brand);
  };

  const handleConfirmRenewTrial = () => {
    if (!renewTargetBrand) return;
    const res = renewBrandTrial(renewTargetBrand.id, renewStartOption, renewDaysCount);
    if (res.success) {
      refreshBrands();
      showToast(
        `Trial renewed for ${renewDaysCount} days starting from ${
          renewStartOption === "previous_end" ? "previous end date" : "today"
        } (${res.daysLeft} days remaining).`
      );
      setRenewTargetBrand(null);
    }
  };

  const handleSwitchPlan = async (brandId: string, plan: BrandPlan) => {
    if (user && !user.isDemoSession) {
      await adminApiService.updateTrial(brandId, { selected_plan: plan });
    } else {
      updateBrandPlan(brandId, plan);
    }
    await refreshBrands();
    showToast(`Brand subscription plan changed to ${plan === "studio" ? "Studio" : "Starter"}.`);
  };

  const handleToggleProfileVisibility = (brandId: string) => {
    if (!selectedBrand) return;
    const nextVis = selectedBrand.profileVisibility === "hidden" ? "public" : "hidden";
    updateBrandVisibility(brandId, nextVis, undefined);
    refreshBrands();
    showToast(`Brand profile public visibility set to ${nextVis.toUpperCase()}.`);
  };

  const handleToggleChartVisibility = (brandId: string) => {
    if (!selectedBrand) return;
    const nextVis = selectedBrand.chartVisibility === "hidden" ? "public" : "hidden";
    updateBrandVisibility(brandId, undefined, nextVis);
    refreshBrands();
    showToast(`Sizing chart public visibility set to ${nextVis.toUpperCase()}.`);
  };

  // Helper for trial calculation based on real date timestamps
  const getTrialDetails = (endDateStr?: string) => {
    if (!endDateStr) {
      return { daysLeft: 10, isExpired: false, isEndingSoon: false, formattedDate: "—" };
    }
    const end = new Date(endDateStr).getTime();
    const now = Date.now();
    const diffMs = end - now;
    const daysLeft = Math.ceil(diffMs / 86400000);
    const isExpired = diffMs <= 0;
    const isEndingSoon = !isExpired && daysLeft <= 3;
    const formattedDate = new Date(end).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return { daysLeft, isExpired, isEndingSoon, formattedDate };
  };

  // Live Metrics derived directly from local demo state
  const metrics = useMemo(() => {
    const total = brands.length;
    let pendingCount = 0;
    let activeTrialCount = 0;
    let endingSoonCount = 0;
    let expiredCount = 0;
    let renewalPendingCount = 0;
    let chartsCount = 0;

    brands.forEach((b) => {
      if (b.status === "pending_review") pendingCount++;
      const { isExpired, isEndingSoon } = getTrialDetails(b.trialEndDate);
      if (b.status === "active" && !isExpired) activeTrialCount++;
      if (isEndingSoon) endingSoonCount++;
      if (isExpired) expiredCount++;
      if (b.renewalIntent === "pending" || b.renewalIntent === "not_asked") renewalPendingCount++;
      if (b.sizingChart) chartsCount++;
    });

    return {
      total,
      pendingCount,
      activeTrialCount,
      endingSoonCount,
      expiredCount,
      renewalPendingCount,
      chartsCount,
    };
  }, [brands]);

  // Filtered and Searched Brand List
  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        brand.name.toLowerCase().includes(q) ||
        (brand.contactPerson && brand.contactPerson.toLowerCase().includes(q)) ||
        brand.contactEmail.toLowerCase().includes(q) ||
        brand.location.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const { isExpired, isEndingSoon } = getTrialDetails(brand.trialEndDate);

      // Status tab filter
      if (activeTab === "pending") return brand.status === "pending_review";
      if (activeTab === "active") return brand.status === "active";
      if (activeTab === "ending_soon") return isEndingSoon;
      if (activeTab === "expired") return isExpired;
      if (activeTab === "renewal_pending") {
        return brand.renewalIntent === "pending" || isExpired;
      }

      return true;
    });
  }, [brands, searchQuery, activeTab]);

  // Mutating Actions
  const executeApprove = (brandId: string) => {
    setConfirmDialog({
      title: "Approve Brand Application",
      message: "Are you sure you want to approve this brand partner studio? Their status will change to Active and their sizing chart will be published.",
      confirmLabel: "Approve Brand",
      onConfirm: async () => {
        if (user && !user.isDemoSession) {
          await adminApiService.approveBrand(brandId, adminNotesText);
        } else {
          updateBrandStatus(brandId, "active", "Application approved by platform admin.");
        }
        await refreshBrands();
        showToast("Brand application approved successfully.");
        setConfirmDialog(null);
      },
    });
  };

  const executeReject = (brandId: string) => {
    setConfirmDialog({
      title: "Reject Brand Application",
      message: "Are you sure you want to reject this application?",
      confirmLabel: "Reject Application",
      isDestructive: true,
      onConfirm: async () => {
        if (user && !user.isDemoSession) {
          await adminApiService.rejectBrand(brandId, "Application rejected during verification.", adminNotesText);
        } else {
          updateBrandStatus(brandId, "rejected", "Application rejected during verification.");
        }
        await refreshBrands();
        showToast("Brand application marked as rejected.");
        setConfirmDialog(null);
      },
    });
  };

  const executeSuspend = (brandId: string) => {
    setConfirmDialog({
      title: "Suspend Brand Account",
      message: "Suspend this brand's public profile and customer sizing matches?",
      confirmLabel: "Suspend Brand",
      isDestructive: true,
      onConfirm: async () => {
        if (user && !user.isDemoSession) {
          await adminApiService.suspendBrand(brandId, "Brand account suspended.");
        } else {
          updateBrandStatus(brandId, "suspended");
        }
        await refreshBrands();
        showToast("Brand account suspended.");
        setConfirmDialog(null);
      },
    });
  };

  const executeReactivate = (brandId: string) => {
    setConfirmDialog({
      title: "Reactivate Brand Account",
      message: "Reactivate this brand studio and restore active trial access?",
      confirmLabel: "Reactivate Brand",
      onConfirm: async () => {
        if (user && !user.isDemoSession) {
          await adminApiService.reactivateBrand(brandId, adminNotesText);
        } else {
          updateBrandStatus(brandId, "active");
        }
        await refreshBrands();
        showToast("Brand studio reactivated.");
        setConfirmDialog(null);
      },
    });
  };

  const executeRecordRenewalInquiry = (brandId: string) => {
    recordRenewalInquiry(brandId);
    refreshBrands();
    showToast("Renewal inquiry status recorded locally. Note added to brand history.");
  };

  const executeUpdateRenewalIntent = (brandId: string, intent: RenewalIntent) => {
    updateBrandRenewalIntent(brandId, intent);
    refreshBrands();
    showToast(`Renewal intent updated to: ${intent.toUpperCase()}`);
  };

  const executeSaveNotes = (brandId: string) => {
    updateAdminNotes(brandId, adminNotesText);
    refreshBrands();
    showToast("Admin notes saved to local storage.");
  };

  return (
    <>
      <SEO
        title="Platform Admin Workspace | PressOn Fit"
        description="Comprehensive press-on nail brand management, trial monitoring, and chart review workspace."
      />

      <div className="section-shell py-8 md:py-12 space-y-8">
        {/* Top Header / Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
              title="Return to Home"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  <ShieldCheck className="size-3.5" />
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Platform Admin Workspace
                </h1>
                <span className="rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5">
                  Local Demo State
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Manage press-on partner applications, monitor 10-day trial expirations, and verify sizing charts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <Link to="/brand/brand-aura-luxury/dashboard">
                <Layers className="size-3.5" />
                Preview Brand Workspace
              </Link>
            </Button>
          </div>
        </div>

        {/* Global Toast Message */}
        {toastMessage && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 animate-in fade-in slide-in-from-top-2 duration-200">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Concise Demo Notice Banner (Single place, not repeated everywhere) */}
        <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-muted-foreground shrink-0" />
            <span>
              <strong>Operational Demo:</strong> Actions (Approve, Reject, Extend Trial, Notes) update browser localStorage. No real emails or server API calls are made.
            </span>
          </div>
          <span className="hidden sm:inline-block text-[11px] font-mono text-muted-foreground shrink-0">
            Storage: local demo
          </span>
        </div>

        {/* 6 Real Overview Metric Cards */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
          {/* Card 1: Total Brands */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Total Studios
            </span>
            <p className="mt-1.5 text-2xl font-bold text-foreground">{metrics.total}</p>
            <span className="mt-1 block text-[10px] text-muted-foreground">Registered in demo</span>
          </div>

          {/* Card 2: Pending Applications */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Awaiting Review
            </span>
            <p className="mt-1.5 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {metrics.pendingCount}
            </p>
            <span className="mt-1 block text-[10px] text-muted-foreground">Applications pending</span>
          </div>

          {/* Card 3: Active Trials */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Active Trials
            </span>
            <p className="mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.activeTrialCount}
            </p>
            <span className="mt-1 block text-[10px] text-muted-foreground">Within 10-day window</span>
          </div>

          {/* Card 4: Expiring Soon */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Ending Soon (≤3d)
            </span>
            <p className="mt-1.5 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {metrics.endingSoonCount}
            </p>
            <span className="mt-1 block text-[10px] text-muted-foreground">Renewal inquiry needed</span>
          </div>

          {/* Card 5: Trial Expired / Renewal */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Expired Trials
            </span>
            <p className="mt-1.5 text-2xl font-bold text-destructive">
              {metrics.expiredCount}
            </p>
            <span className="mt-1 block text-[10px] text-muted-foreground">Decision pending</span>
          </div>

          {/* Card 6: Size Charts */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Active Charts
            </span>
            <p className="mt-1.5 text-2xl font-bold text-foreground">
              {metrics.chartsCount}
            </p>
            <span className="mt-1 block text-[10px] text-muted-foreground">Calibrated in mm</span>
          </div>
        </div>

        {/* Brand Management Table Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
          {/* Controls: Search & Tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === "all"
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({metrics.total})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("pending")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === "pending"
                    ? "bg-amber-600 text-white"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Pending Review ({metrics.pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === "active"
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Active ({metrics.activeTrialCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ending_soon")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === "ending_soon"
                    ? "bg-amber-600 text-white"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Ending Soon ({metrics.endingSoonCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("expired")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === "expired"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Expired ({metrics.expiredCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search studio, contact, email..."
                className="w-full rounded-xl border border-border bg-background pl-8.5 pr-3 py-1.5 text-xs outline-none focus:border-foreground/40 transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                  <th className="py-3 px-4">Brand / Studio</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Active Chart</th>
                  <th className="py-3 px-3">Trial End Date</th>
                  <th className="py-3 px-3">Trial Days</th>
                  <th className="py-3 px-3">Renewal Intent</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBrands.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No brands found matching the selected filter or query.
                    </td>
                  </tr>
                ) : (
                  filteredBrands.map((brand) => {
                    const { daysLeft, isExpired, isEndingSoon, formattedDate } = getTrialDetails(
                      brand.trialEndDate
                    );

                    return (
                      <tr key={brand.id} className="hover:bg-muted/20 transition-colors">
                        {/* Brand & Person */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-foreground block">{brand.name}</span>
                          <span className="text-[11px] text-muted-foreground">{brand.location}</span>
                        </td>

                        {/* Contact Person & Email */}
                        <td className="py-3 px-3">
                          <span className="font-medium text-foreground block">
                            {brand.contactPerson || "Studio Manager"}
                          </span>
                          <span className="text-[11px] text-muted-foreground block truncate max-w-[150px]">
                            {brand.contactEmail}
                          </span>
                        </td>

                        {/* Account Status Badge */}
                        <td className="py-3 px-3">
                          {brand.status === "active" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">
                              Active
                            </span>
                          )}
                          {brand.status === "pending_review" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-semibold">
                              Pending Review
                            </span>
                          )}
                          {brand.status === "suspended" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold">
                              Suspended
                            </span>
                          )}
                          {brand.status === "rejected" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-semibold">
                              Rejected
                            </span>
                          )}
                        </td>

                        {/* Chart Name */}
                        <td className="py-3 px-3">
                          <span className="font-medium text-foreground truncate block max-w-[140px]">
                            {brand.sizingChart.chartName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {Object.keys(brand.sizingChart.sizes).length} sizes ({brand.sizingChart.unit})
                          </span>
                        </td>

                        {/* Trial End Date */}
                        <td className="py-3 px-3 font-mono text-muted-foreground">
                          {formattedDate}
                        </td>

                        {/* Days Remaining */}
                        <td className="py-3 px-3">
                          {isExpired ? (
                            <span className="font-semibold text-destructive">Expired</span>
                          ) : isEndingSoon ? (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              {daysLeft} {daysLeft === 1 ? "day" : "days"} (Soon)
                            </span>
                          ) : (
                            <span className="font-medium text-foreground">
                              {daysLeft} {daysLeft === 1 ? "day" : "days"}
                            </span>
                          )}
                        </td>

                        {/* Renewal Intent */}
                        <td className="py-3 px-3">
                          {brand.renewalIntent === "yes" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">
                              Confirmed (Yes)
                            </span>
                          )}
                          {brand.renewalIntent === "no" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-semibold">
                              Opted Out (No)
                            </span>
                          )}
                          {brand.renewalIntent === "pending" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-semibold">
                              Inquired (Pending)
                            </span>
                          )}
                          {(!brand.renewalIntent || brand.renewalIntent === "not_asked") && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold">
                              Not Asked
                            </span>
                          )}
                        </td>

                        {/* Action: View Details */}
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenBrandDetails(brand)}
                            className="h-7 px-2.5 text-[11px] font-semibold"
                          >
                            View details
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BRAND DETAIL DRAWER / MODAL */}
      {selectedBrand && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-luxe my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/80">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
                  <Building2 className="size-5" />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    {selectedBrand.name}
                    <span className="rounded-full bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5">
                      {selectedBrand.status.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedBrand.tagline} • {selectedBrand.location}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBrand(null)}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="py-4 space-y-6 text-xs max-h-[70vh] overflow-y-auto pr-1">
              {/* Profile & Contact Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border bg-muted/20 p-4">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Contact Person
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedBrand.contactPerson || "Studio Manager"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Contact Email
                  </span>
                  <span className="font-semibold text-foreground">{selectedBrand.contactEmail}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Instagram Handle
                  </span>
                  <span className="font-semibold text-foreground">
                    {selectedBrand.instagram || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Website URL
                  </span>
                  <span className="font-semibold text-foreground truncate block">
                    {selectedBrand.website || "—"}
                  </span>
                </div>
              </div>

              {/* Trial & Renewal Lifecycle Section */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                    <Clock className="size-4 text-foreground" />
                    Trial & Renewal Operations
                  </span>
                  <span className="rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5">
                    Local Demo State
                  </span>
                </div>

                {(() => {
                  const { daysLeft, isExpired, formattedDate } = getTrialDetails(
                    selectedBrand.trialEndDate
                  );
                  return (
                    <div className="space-y-4">
                      {/* Status and Countdown banner */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-muted/40 border border-border/50">
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                            Current Trial Countdown
                          </span>
                          <span className="font-bold text-sm text-foreground">
                            {isExpired ? (
                              <span className="text-destructive font-semibold">Trial Expired</span>
                            ) : (
                              <span>{daysLeft} days remaining</span>
                            )}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                            Expiration Date
                          </span>
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {formattedDate}
                          </span>
                        </div>
                      </div>

                      {/* Direct Date Editor */}
                      <div className="space-y-2 pt-1 border-t border-border/40">
                        <span className="text-[11px] font-bold text-foreground block">
                          Edit Start & Expiration Timestamps
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">
                              Trial Start Date:
                            </label>
                            <input
                              type="date"
                              value={editStartDate}
                              onChange={(e) => setEditStartDate(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-mono outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">
                              Trial End Date:
                            </label>
                            <input
                              type="date"
                              value={editEndDate}
                              onChange={(e) => setEditEndDate(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-mono outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSaveTrialDates}
                            className="h-7 text-xs font-semibold"
                          >
                            Save Dates
                          </Button>
                        </div>
                      </div>

                      {/* Quick Extensions & Renew Trial */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground mr-1">Extend:</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExtendTrial(selectedBrand.id, 7)}
                            className="h-7 px-2.5 text-xs font-semibold"
                          >
                            +7 Days
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExtendTrial(selectedBrand.id, 30)}
                            className="h-7 px-2.5 text-xs font-semibold"
                          >
                            +30 Days
                          </Button>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleOpenRenewDialog(selectedBrand)}
                          className="h-7 px-3 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
                        >
                          <RotateCw className="size-3" />
                          Renew Trial...
                        </Button>
                      </div>

                      {/* Renewal Intent Selector */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">Renewal Intent:</span>
                          <select
                            value={selectedBrand.renewalIntent || "not_asked"}
                            onChange={(e) =>
                              executeUpdateRenewalIntent(
                                selectedBrand.id,
                                e.target.value as RenewalIntent
                              )
                            }
                            className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold outline-none focus:border-primary"
                          >
                            <option value="not_asked">Not Asked</option>
                            <option value="yes">Confirmed (Yes)</option>
                            <option value="pending">Inquiry Pending</option>
                            <option value="no">Opted Out (No)</option>
                          </select>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => executeRecordRenewalInquiry(selectedBrand.id)}
                          className="text-xs h-7"
                        >
                          Log Renewal Follow-up
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Subscription Plan & Public Visibility Controls */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                    <Sparkles className="size-4 text-foreground" />
                    Subscription Plan & Visibility
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Plan Switcher */}
                  <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Brand Plan
                      </span>
                      <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">
                        {selectedBrand.plan === "studio" ? "Studio" : "Starter"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedBrand.plan === "studio"
                        ? "Studio: Multiple sizing charts, full public profile, advanced visibility controls."
                        : "Starter: 1 public sizing chart, standard profile, view-only post-trial."}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant={selectedBrand.plan !== "studio" ? "default" : "outline"}
                        onClick={() => handleSwitchPlan(selectedBrand.id, "starter")}
                        className="h-6 text-[10px] px-2 font-semibold"
                      >
                        Set Starter
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedBrand.plan === "studio" ? "default" : "outline"}
                        onClick={() => handleSwitchPlan(selectedBrand.id, "studio")}
                        className="h-6 text-[10px] px-2 font-semibold"
                      >
                        Set Studio
                      </Button>
                    </div>
                  </div>

                  {/* Visibility Toggles */}
                  <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-2.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Public Visibility
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground">Brand Profile:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleProfileVisibility(selectedBrand.id)}
                        className={`h-6 text-[10px] px-2.5 font-semibold flex items-center gap-1 ${
                          selectedBrand.profileVisibility === "hidden"
                            ? "border-muted-foreground text-muted-foreground"
                            : "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                        }`}
                      >
                        {selectedBrand.profileVisibility === "hidden" ? (
                          <>
                            <EyeOff className="size-3" /> Hidden
                          </>
                        ) : (
                          <>
                            <Eye className="size-3" /> Public
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-foreground">Sizing Chart:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleChartVisibility(selectedBrand.id)}
                        className={`h-6 text-[10px] px-2.5 font-semibold flex items-center gap-1 ${
                          selectedBrand.chartVisibility === "hidden"
                            ? "border-muted-foreground text-muted-foreground"
                            : "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                        }`}
                      >
                        {selectedBrand.chartVisibility === "hidden" ? (
                          <>
                            <EyeOff className="size-3" /> Hidden
                          </>
                        ) : (
                          <>
                            <Eye className="size-3" /> Public
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sizing Chart Details (Supports both Format A & Format B) */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div>
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Table className="size-4 text-foreground" />
                      Sizing Chart: {selectedBrand.sizingChart.chartName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Format:{" "}
                      <strong>
                        {selectedBrand.sizingChart.format === "width_ranges"
                          ? "Format B (Nail Width Ranges)"
                          : "Format A (Per-Size Finger Table)"}
                      </strong>
                    </span>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-xs">
                    <Link to={`/brands/${selectedBrand.slug}`} target="_blank">
                      View Public Chart <ExternalLink className="size-3 ml-1" />
                    </Link>
                  </Button>
                </div>

                {selectedBrand.sizingChart.format === "width_ranges" &&
                selectedBrand.sizingChart.ranges &&
                selectedBrand.sizingChart.ranges.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground uppercase">
                          <th className="py-1.5 px-2">Press-On Size</th>
                          <th className="py-1.5 px-2">Min Width</th>
                          <th className="py-1.5 px-2">Max Width</th>
                          <th className="py-1.5 px-2">Span</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono">
                        {selectedBrand.sizingChart.ranges.map((r, i) => (
                          <tr key={i}>
                            <td className="py-1.5 px-2 font-bold font-sans text-foreground">
                              Size {r.sizeLabel}
                            </td>
                            <td className="py-1.5 px-2">{r.minMm} mm</td>
                            <td className="py-1.5 px-2">{r.maxMm} mm</td>
                            <td className="py-1.5 px-2 text-muted-foreground">
                              {(r.maxMm - r.minMm).toFixed(1)} mm
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground uppercase">
                          <th className="py-1.5 px-2">Size</th>
                          <th className="py-1.5 px-2">Thumb</th>
                          <th className="py-1.5 px-2">Index</th>
                          <th className="py-1.5 px-2">Middle</th>
                          <th className="py-1.5 px-2">Ring</th>
                          <th className="py-1.5 px-2">Pinky</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono">
                        {Object.entries(selectedBrand.sizingChart.sizes || {}).map(
                          ([sz, dims]) => (
                            <tr key={sz}>
                              <td className="py-1.5 px-2 font-bold font-sans text-foreground">
                                {sz}
                              </td>
                              <td className="py-1.5 px-2">{dims.thumb} mm</td>
                              <td className="py-1.5 px-2">{dims.index} mm</td>
                              <td className="py-1.5 px-2">{dims.middle} mm</td>
                              <td className="py-1.5 px-2">{dims.ring} mm</td>
                              <td className="py-1.5 px-2">{dims.pinky} mm</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Admin Notes Field */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="font-bold text-foreground block">Admin Notes & Verification Log</span>
                <textarea
                  rows={3}
                  value={adminNotesText}
                  onChange={(e) => setAdminNotesText(e.target.value)}
                  placeholder="Add private studio review notes or verification findings..."
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-xs outline-none focus:border-foreground/40 transition-colors"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => executeSaveNotes(selectedBrand.id)}
                    className="h-7 text-xs"
                  >
                    Save Notes (Local Demo)
                  </Button>
                </div>
              </div>

              {/* Lifecycle Mutating Actions */}
              <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {selectedBrand.status === "pending_review" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => executeApprove(selectedBrand.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                      >
                        Approve Application
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => executeReject(selectedBrand.id)}
                        className="h-8 text-xs"
                      >
                        Reject Application
                      </Button>
                    </>
                  )}

                  {selectedBrand.status === "active" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => executeSuspend(selectedBrand.id)}
                      className="h-8 text-xs"
                    >
                      Suspend Studio Account
                    </Button>
                  )}

                  {(selectedBrand.status === "suspended" || selectedBrand.status === "rejected") && (
                    <Button
                      size="sm"
                      onClick={() => executeReactivate(selectedBrand.id)}
                      className="h-8 text-xs"
                    >
                      Reactivate Studio
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBrand(null)}
                  className="h-8 text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENEW TRIAL ACTION DIALOG */}
      {renewTargetBrand && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-luxe space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <RotateCw className="size-4 text-foreground" />
                <h4 className="text-base font-bold text-foreground">
                  Renew Trial: {renewTargetBrand.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setRenewTargetBrand(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Renewing the trial resets status to <strong>Active</strong> and updates the expiration timestamp in local demo storage. Choose how the new period should begin:
            </p>

            {/* Start Choice */}
            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3 text-xs">
              <span className="font-semibold text-foreground block">Renewal Start Date:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="renewFrom"
                  checked={renewStartOption === "previous_end"}
                  onChange={() => setRenewStartOption("previous_end")}
                  className="accent-primary"
                />
                <span>
                  <strong>Continuous:</strong> From previous end date (
                  {renewTargetBrand.trialEndDate
                    ? new Date(renewTargetBrand.trialEndDate).toLocaleDateString()
                    : "now"}
                  )
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="renewFrom"
                  checked={renewStartOption === "today"}
                  onChange={() => setRenewStartOption("today")}
                  className="accent-primary"
                />
                <span>
                  <strong>Fresh Start:</strong> From current date ({new Date().toLocaleDateString()})
                </span>
              </label>
            </div>

            {/* Duration Choice */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground">Renewal Extension:</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={renewDaysCount === 10 ? "default" : "outline"}
                  onClick={() => setRenewDaysCount(10)}
                  className="h-7 text-xs font-semibold px-2.5"
                >
                  10 Days (Demo)
                </Button>
                <Button
                  size="sm"
                  variant={renewDaysCount === 30 ? "default" : "outline"}
                  onClick={() => setRenewDaysCount(30)}
                  className="h-7 text-xs font-semibold px-2.5"
                >
                  30 Days
                </Button>
              </div>
            </div>

            {/* Note */}
            <p className="text-[11px] text-muted-foreground italic">
              * Local demo action. No automated billing or real email is dispatched.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRenewTargetBrand(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmRenewTrial}
                className="h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Confirm Renewal ({renewDaysCount}d)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      {confirmDialog && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-luxe space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-base font-bold text-foreground">{confirmDialog.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant={confirmDialog.isDestructive ? "destructive" : "default"}
                onClick={confirmDialog.onConfirm}
                className="h-8 text-xs font-semibold"
              >
                {confirmDialog.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminPreviewPage;
