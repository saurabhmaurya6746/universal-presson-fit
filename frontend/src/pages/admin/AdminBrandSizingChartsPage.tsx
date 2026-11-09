import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  adminApiService,
  AdminSizingChartListItem,
  AdminChartEntryPayload,
  AdminCreateBrandChartPayload,
} from "@/services/adminApiService";
import { getBrands } from "@/services/brandService";
import {
  Plus,
  ArrowLeft,
  Search,
  CheckCircle2,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  ExternalLink,
  Layers,
  AlertCircle,
  X,
  RotateCw,
  Building2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import { PageIntro } from "@/components/ui/PageIntro";

type ChartFormatType = "preset_set" | "numbered_size" | "shape_range" | "length_only_numbered";

export function AdminBrandSizingChartsPage() {
  const { user } = useAuthUser();
  const [charts, setCharts] = useState<AdminSizingChartListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [formatFilter, setFormatFilter] = useState<"all" | ChartFormatType>("all");

  // Modal / Drawer state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [brandName, setBrandName] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [brandTagline, setBrandTagline] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [shapesInput, setShapesInput] = useState("");
  const [chartName, setChartName] = useState("");
  const [chartFormat, setChartFormat] = useState<ChartFormatType>("preset_set");
  const [unit, setUnit] = useState("mm");
  const [chartStatus, setChartStatus] = useState<"draft" | "published">("published");
  const [customNotes, setCustomNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("user_provided");

  // Dynamic Entries
  const [entries, setEntries] = useState<AdminChartEntryPayload[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadCharts = async () => {
    setIsLoading(true);
    try {
      const isRemote = !user?.isDemoSession;
      if (isRemote) {
        const apiCharts = await adminApiService.listSizingCharts();
        if (apiCharts && apiCharts.length > 0) {
          setCharts(apiCharts);
          setIsLoading(false);
          return;
        }
      }

      // Fallback / Demo data mode from brandService
      const demoBrands = getBrands();
      const mapped: AdminSizingChartListItem[] = demoBrands
        .filter((b) => b.sizingChart)
        .map((b) => ({
          id: b.sizingChart.id,
          brand_id: b.id,
          brand_name: b.name,
          brand_slug: b.slug,
          brand_logo_url: b.logo_url || null,
          is_official: Boolean(b.is_official),
          chart_name: b.sizingChart.chartName,
          format: b.sizingChart.format || "preset_set",
          unit: b.sizingChart.unit || "mm",
          status: b.status === "active" ? "published" : "draft",
          is_public: b.chartVisibility !== "hidden",
          version: 1,
          entry_count:
            b.sizingChart.format === "shape_range"
              ? b.sizingChart.shape_ranges?.length || 0
              : b.sizingChart.format === "numbered_size"
              ? b.sizingChart.numbered_sizes?.length || 0
              : Object.keys(b.sizingChart.sizes || {}).length,
          shapes_count: b.shapes.length,
          source_url: b.sizingChart.source_url || null,
          verification_status: b.sizingChart.verification_status || "user_provided",
          updated_at: b.sizingChart.updatedDate || "2026-11-08",
        }));
      setCharts(mapped);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load sizing charts.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCharts();
  }, [user]);

  // Handle format change in editor
  const handleFormatChange = (newFmt: ChartFormatType) => {
    setChartFormat(newFmt);
    if (newFmt === "preset_set") {
      setEntries([
        { size_label: "XS", thumb_width_mm: 14, index_width_mm: 10, middle_width_mm: 11, ring_width_mm: 10, pinky_width_mm: 9, display_order: 0 },
        { size_label: "S", thumb_width_mm: 15, index_width_mm: 11, middle_width_mm: 12, ring_width_mm: 11, pinky_width_mm: 9, display_order: 1 },
        { size_label: "M", thumb_width_mm: 16, index_width_mm: 12, middle_width_mm: 13, ring_width_mm: 12, pinky_width_mm: 10, display_order: 2 },
        { size_label: "L", thumb_width_mm: 17, index_width_mm: 13, middle_width_mm: 14, ring_width_mm: 13, pinky_width_mm: 10, display_order: 3 },
      ]);
    } else if (newFmt === "numbered_size") {
      setEntries([
        { size_label: "0", width_mm: 7, is_approximate: true, typical_finger: "Pinky (petite)", display_order: 0 },
        { size_label: "1", width_mm: 8, is_approximate: true, typical_finger: "Pinky (average)", display_order: 1 },
        { size_label: "2", width_mm: 9, is_approximate: true, typical_finger: "Ring (petite)", display_order: 2 },
        { size_label: "3", width_mm: 10, is_approximate: true, typical_finger: "Ring / Middle", display_order: 3 },
        { size_label: "4", width_mm: 11, is_approximate: true, typical_finger: "Middle", display_order: 4 },
        { size_label: "5", width_mm: 12, is_approximate: true, typical_finger: "Index / Thumb (petite)", display_order: 5 },
        { size_label: "6", width_mm: 13, is_approximate: true, typical_finger: "Thumb (average)", display_order: 6 },
        { size_label: "7", width_mm: 14, is_approximate: true, typical_finger: "Thumb (wider)", display_order: 7 },
        { size_label: "8", min_width_mm: 15, max_width_mm: 16, is_approximate: true, typical_finger: "Thumb (wide beds)", display_order: 8 },
        { size_label: "9", width_mm: 17, is_approximate: true, typical_finger: "Thumb (extra wide)", display_order: 9 },
      ]);
    } else if (newFmt === "shape_range") {
      setEntries([
        { size_label: "Short Round", shape: "Short Round", min_length_mm: 13.6, max_length_mm: 22.0, min_width_mm: 6.7, max_width_mm: 14.0, thickness_mm: 0.6, display_order: 0 },
        { size_label: "Short Almond", shape: "Short Almond", min_length_mm: 15.3, max_length_mm: 22.3, min_width_mm: 6.5, max_width_mm: 14.1, thickness_mm: 0.6, display_order: 1 },
        { size_label: "Medium Square", shape: "Medium Square", min_length_mm: 15.3, max_length_mm: 19.5, min_width_mm: 6.5, max_width_mm: 13.9, thickness_mm: 0.6, display_order: 2 },
      ]);
    } else if (newFmt === "length_only_numbered") {
      const defaultShapes = [
        "Short Oval", "Short Square", "Regular Square", "Regular Coffin",
        "Regular Stiletto", "Regular Oval", "Regular Almond",
        "Long Square", "Long Coffin", "Long Stiletto",
      ];
      const initial: AdminChartEntryPayload[] = [];
      let order = 0;
      for (const shp of defaultShapes) {
        for (let num = 0; num <= 9; num++) {
          initial.push({
            size_label: `#${num}`,
            shape: shp,
            length_mm: 20,
            display_order: order++,
          });
        }
      }
      setEntries(initial);
    }
  };

  // Open modal for new chart
  const handleOpenNew = () => {
    setEditingChartId(null);
    setBrandName("");
    setBrandSlug("");
    setBrandTagline("");
    setBrandDescription("");
    setLogoUrl("");
    setWebsite("");
    setShapesInput("Almond, Square, Coffin, Oval");
    setChartName("Official Brand Sizing Guide");
    setChartFormat("preset_set");
    setUnit("mm");
    setChartStatus("published");
    setCustomNotes("");
    setSourceUrl("");
    setSourceNotes("");
    setVerificationStatus("user_provided");
    handleFormatChange("preset_set");
    setPreviewMode(false);
    setIsEditorOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = async (chartItem: AdminSizingChartListItem) => {
    setEditingChartId(chartItem.id);
    setIsLoading(true);
    setPreviewMode(false);

    try {
      const full = await adminApiService.getSizingChart(chartItem.id);
      if (full) {
        setBrandName(full.brand_name);
        setBrandSlug(full.brand_slug);
        setBrandTagline("");
        setBrandDescription(full.brand_description || "");
        setLogoUrl(full.brand_logo_url || "");
        setWebsite(full.brand_website || "");
        setShapesInput((full.brand_shapes || []).join(", "));
        setChartName(full.chart_name);
        const fmtRaw = full.format.toLowerCase();
        const fmtNorm = (fmtRaw.includes("length")
          ? "length_only_numbered"
          : fmtRaw.includes("number")
          ? "numbered_size"
          : fmtRaw.includes("shape")
          ? "shape_range"
          : "preset_set") as ChartFormatType;
        setChartFormat(fmtNorm);
        setUnit(full.unit || "mm");
        setChartStatus(full.status === "published" ? "published" : "draft");
        setCustomNotes(full.custom_notes || "");
        setSourceUrl(full.source_url || "");
        setSourceNotes(full.source_notes || "");
        setVerificationStatus(full.verification_status || "user_provided");
        setEntries(full.entries || []);
      } else {
        // From demo brand
        const brand = getBrands().find((b) => b.sizingChart?.id === chartItem.id);
        if (brand) {
          setBrandName(brand.name);
          setBrandSlug(brand.slug);
          setBrandTagline(brand.tagline);
          setBrandDescription(brand.description);
          setLogoUrl(brand.logo_url || "");
          setWebsite(brand.website || "");
          setShapesInput((brand.shapes || []).join(", "));
          setChartName(brand.sizingChart.chartName);
          const fmt = (brand.sizingChart.format || "preset_set") as ChartFormatType;
          setChartFormat(fmt);
          setUnit(brand.sizingChart.unit || "mm");
          setChartStatus(brand.status === "active" ? "published" : "draft");
          setCustomNotes(brand.sizingChart.customNotes || "");
          setSourceUrl(brand.sizingChart.source_url || "");
          setSourceNotes(brand.sizingChart.source_notes || "");
          setVerificationStatus(brand.sizingChart.verification_status || "user_provided");
          if (fmt === "length_only_numbered" && brand.sizingChart.length_numbered_sizes) {
            const list: AdminChartEntryPayload[] = [];
            let ord = 0;
            for (const [shp, sizes] of Object.entries(brand.sizingChart.length_numbered_sizes)) {
              for (const [sz, len] of Object.entries(sizes)) {
                list.push({
                  size_label: sz,
                  shape: shp,
                  length_mm: len,
                  display_order: ord++,
                });
              }
            }
            setEntries(list);
          } else if (fmt === "shape_range" && brand.sizingChart.shape_ranges) {
            setEntries(
              brand.sizingChart.shape_ranges.map((sr, idx) => ({
                size_label: sr.shape,
                shape: sr.shape,
                min_length_mm: sr.length_min_mm,
                max_length_mm: sr.length_max_mm,
                min_width_mm: sr.width_min_mm,
                max_width_mm: sr.width_max_mm,
                thickness_mm: sr.thickness_mm,
                display_order: idx,
              }))
            );
          } else if (fmt === "numbered_size" && brand.sizingChart.numbered_sizes) {
            setEntries(
              brand.sizingChart.numbered_sizes.map((ns, idx) => ({
                size_label: ns.size,
                width_mm: ns.width_mm,
                min_width_mm: ns.min_width_mm,
                max_width_mm: ns.max_width_mm,
                is_approximate: ns.is_approximate,
                typical_finger: ns.typical_finger,
                display_order: idx,
              }))
            );
          } else {
            setEntries(
              Object.entries(brand.sizingChart.sizes || {}).map(([sz, f], idx) => ({
                size_label: sz,
                thumb_width_mm: f.thumb,
                index_width_mm: f.index,
                middle_width_mm: f.middle,
                ring_width_mm: f.ring,
                pinky_width_mm: f.pinky,
                display_order: idx,
              }))
            );
          }
        }
      }
      setIsEditorOpen(true);
    } catch {
      showToast("Failed to load chart details.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add / remove rows in dynamic table
  const handleAddRow = () => {
    const nextOrder = entries.length;
    if (chartFormat === "preset_set") {
      setEntries([
        ...entries,
        { size_label: `Size ${nextOrder + 1}`, thumb_width_mm: 15, index_width_mm: 11, middle_width_mm: 12, ring_width_mm: 11, pinky_width_mm: 9, display_order: nextOrder },
      ]);
    } else if (chartFormat === "numbered_size") {
      setEntries([
        ...entries,
        { size_label: String(nextOrder), width_mm: 10, is_approximate: false, typical_finger: "", display_order: nextOrder },
      ]);
    } else {
      setEntries([
        ...entries,
        { size_label: `New Shape`, shape: `New Shape`, min_length_mm: 12, max_length_mm: 18, min_width_mm: 6.5, max_width_mm: 14.0, thickness_mm: 0.6, display_order: nextOrder },
      ]);
    }
  };

  const handleRemoveRow = (idx: number) => {
    setEntries(entries.filter((_, i) => i !== idx));
  };

  const handleEntryChange = (idx: number, field: keyof AdminChartEntryPayload, value: any) => {
    setEntries(
      entries.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  // Save chart (Draft or Publish)
  const handleSave = async (targetStatus?: "draft" | "published") => {
    if (!brandName.trim()) {
      showToast("Please provide a brand name.");
      return;
    }
    if (!chartName.trim()) {
      showToast("Please provide a chart name.");
      return;
    }
    if (entries.length === 0) {
      showToast("Please include at least one measurement entry.");
      return;
    }

    const finalStatus = targetStatus || chartStatus;
    const finalIsPublic = finalStatus === "published";
    setIsSubmitting(true);

    const shapesList = shapesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: AdminCreateBrandChartPayload = {
      brand_name: brandName.trim(),
      brand_slug: brandSlug.trim() || undefined,
      brand_description: brandDescription.trim() || undefined,
      brand_tagline: brandTagline.trim() || undefined,
      logo_url: logoUrl.trim() || undefined,
      website: website.trim() || undefined,
      shapes: shapesList,
      chart_name: chartName.trim(),
      format: chartFormat,
      unit: unit.trim().toLowerCase() || "mm",
      status: finalStatus,
      is_public: finalIsPublic,
      custom_notes: customNotes.trim() || undefined,
      source_url: sourceUrl.trim() || undefined,
      source_notes: sourceNotes.trim() || undefined,
      verification_status: verificationStatus,
      entries,
    };

    try {
      if (editingChartId) {
        const res = await adminApiService.updateSizingChart(editingChartId, payload);
        if (res.success) {
          showToast(`Sizing chart successfully updated (${finalStatus.toUpperCase()}).`);
          setIsEditorOpen(false);
          await loadCharts();
        } else {
          showToast(res.error || "Failed to update sizing chart.");
        }
      } else {
        const res = await adminApiService.createSizingChart(payload);
        if (res.success) {
          showToast(`Brand and sizing chart created successfully (${finalStatus.toUpperCase()})!`);
          setIsEditorOpen(false);
          await loadCharts();
        } else {
          showToast(res.error || "Failed to create sizing chart.");
        }
      }
    } catch (err) {
      showToast("An unexpected error occurred saving the chart.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle publish / unpublish
  const handleTogglePublish = async (chart: AdminSizingChartListItem) => {
    const nextAction = chart.status === "published" ? "unpublish" : "publish";
    const res = await adminApiService.togglePublishChart(chart.id, nextAction);
    if (res.success) {
      showToast(`Chart has been ${nextAction === "publish" ? "published" : "set to draft"}.`);
      loadCharts();
    } else {
      showToast(res.error || `Failed to ${nextAction} chart.`);
    }
  };

  // Delete chart
  const handleDeleteChart = async () => {
    if (!confirmDeleteId) return;
    const res = await adminApiService.deleteSizingChart(confirmDeleteId, true);
    if (res.success) {
      showToast("Brand sizing chart removed.");
      setConfirmDeleteId(null);
      loadCharts();
    } else {
      showToast(res.error || "Failed to delete sizing chart.");
    }
  };

  // Filtered charts list
  const filteredCharts = useMemo(() => {
    return charts.filter((c) => {
      const matchesSearch =
        c.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.chart_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.brand_slug.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || c.status === statusFilter;

      const matchesFormat =
        formatFilter === "all" ||
        c.format.toLowerCase() === formatFilter ||
        (formatFilter === "preset_set" && (c.format.includes("per_size") || c.format.includes("preset"))) ||
        (formatFilter === "numbered_size" && c.format.includes("number") && !c.format.includes("length")) ||
        (formatFilter === "shape_range" && c.format.includes("shape")) ||
        (formatFilter === "length_only_numbered" && c.format.includes("length"));

      return matchesSearch && matchesStatus && matchesFormat;
    });
  }, [charts, searchQuery, statusFilter, formatFilter]);

  return (
    <>
      <SEO
        title="Brand Sizing Charts Management | Nail World Admin"
        description="Administer universal official brand sizing charts, custom formats, and nail shape measurement tables."
      />

      {/* Breadcrumb Navigation */}
      <div className="section-shell pt-8">
        <div className="flex items-center justify-between">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Admin Workspace
          </Link>

          <Button onClick={handleOpenNew} className="gap-2 shadow-soft">
            <Plus className="size-4" />
            Add New Brand Chart
          </Button>
        </div>
      </div>

      <PageIntro
        eyebrow="Universal Sizing Management"
        title="Brand Sizing Charts"
      >
        Manage official brand measurement charts and shape dimension tables. Add new brands, configure preset kits, numbered sizes, and shape ranges without code changes.
      </PageIntro>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-luxe animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="section-shell py-8 space-y-6">
        {/* Controls: Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by brand or chart name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-lavender-deep/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Format Filter */}
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as any)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-none"
            >
              <option value="all">All Formats</option>
              <option value="preset_set">Preset Sets (XS, S, M, L)</option>
              <option value="numbered_size">Numbered Sizes (0–9)</option>
              <option value="shape_range">Shape-Based Ranges</option>
              <option value="length_only_numbered">Length-Only Numbered (#0–#9)</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </select>

            <Button onClick={loadCharts} variant="outline" size="sm" className="gap-1.5">
              <RotateCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Charts Table */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-accent/30 font-semibold uppercase text-muted-foreground tracking-wider">
                  <th className="py-3 px-4">Brand &amp; Logo</th>
                  <th className="py-3 px-4">Chart Name &amp; Format</th>
                  <th className="py-3 px-3">Entries</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Official</th>
                  <th className="py-3 px-3">Source &amp; Verification</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <RotateCw className="size-6 animate-spin mx-auto mb-2 text-lavender-deep" />
                      Loading sizing charts...
                    </td>
                  </tr>
                ) : filteredCharts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No sizing charts found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredCharts.map((c) => {
                    const isPublished = c.status === "published";
                    const isOfficial = Boolean(c.is_official);
                    return (
                      <tr key={c.id} className="hover:bg-accent/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0 font-bold text-xs text-foreground">
                              {c.brand_logo_url ? (
                                <img src={c.brand_logo_url} alt={c.brand_name} className="size-full object-contain p-1" />
                              ) : (
                                c.brand_name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                                {c.brand_name}
                                {isOfficial && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-lavender/60 text-lavender-deep">
                                    Official
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-mono">/{c.brand_slug}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-medium text-foreground">{c.chart_name}</p>
                          <span className="inline-block mt-0.5 rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground uppercase">
                            {c.format.replace("_", " ")}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 font-mono font-medium text-foreground">
                          {c.entry_count} rows
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              isPublished
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                isPublished ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                            />
                            {c.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          {isOfficial ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="size-3.5" />
                              Yes
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Partner Studio</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          <p className="text-[11px] text-foreground font-medium capitalize">
                            {c.verification_status.replace("_", " ")}
                          </p>
                          {c.source_url && (
                            <a
                              href={c.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-lavender-deep hover:underline flex items-center gap-1 mt-0.5"
                            >
                              Source URL <ExternalLink className="size-2.5" />
                            </a>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              onClick={() => handleTogglePublish(c)}
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs gap-1"
                              title={isPublished ? "Unpublish to draft" : "Publish to live catalog"}
                            >
                              {isPublished ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                              {isPublished ? "Unpublish" : "Publish"}
                            </Button>

                            <Button
                              onClick={() => handleOpenEdit(c)}
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs gap-1"
                            >
                              <Edit className="size-3.5" />
                              Edit
                            </Button>

                            <Button
                              onClick={() => setConfirmDeleteId(c.id)}
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
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

      {/* Editor Modal / Drawer */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                  {editingChartId ? `Edit Brand Sizing Chart` : `Add Brand Sizing Chart`}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure format, shape dimensions, and individual millimeter values.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setPreviewMode(!previewMode)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  <Eye className="size-3.5" />
                  {previewMode ? "Back to Edit" : "Preview Table"}
                </Button>
                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {previewMode ? (
              /* LIVE PREVIEW OF SIZING CHART */
              <div className="mt-6 space-y-6">
                <div className="p-4 rounded-2xl border border-border bg-accent/20 flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-card border border-border flex items-center justify-center font-bold text-lg">
                    {logoUrl ? <img src={logoUrl} alt="" className="size-full object-contain p-1" /> : brandName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{brandName || "Brand Name"}</h3>
                    <p className="text-xs text-muted-foreground">{chartName} • Unit: Millimeters ({unit})</p>
                  </div>
                </div>

                {chartFormat === "preset_set" && (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-muted/40 font-sans font-semibold text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3">Size Code</th>
                          <th className="py-2.5 px-3">Thumb</th>
                          <th className="py-2.5 px-3">Index</th>
                          <th className="py-2.5 px-3">Middle</th>
                          <th className="py-2.5 px-3">Ring</th>
                          <th className="py-2.5 px-3">Pinky</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {entries.map((e, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-bold font-sans">{e.size_label}</td>
                            <td className="py-2 px-3">{e.thumb_width_mm ?? "-"} mm</td>
                            <td className="py-2 px-3">{e.index_width_mm ?? "-"} mm</td>
                            <td className="py-2 px-3">{e.middle_width_mm ?? "-"} mm</td>
                            <td className="py-2 px-3">{e.ring_width_mm ?? "-"} mm</td>
                            <td className="py-2 px-3">{e.pinky_width_mm ?? "-"} mm</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {chartFormat === "numbered_size" && (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-muted/40 font-sans font-semibold text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3">Size #</th>
                          <th className="py-2.5 px-3">Width (mm)</th>
                          <th className="py-2.5 px-3">Typical Finger</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {entries.map((e, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-bold font-sans">#{e.size_label}</td>
                            <td className="py-2 px-3">
                              {e.is_approximate ? "~" : ""}
                              {e.min_width_mm !== null && e.max_width_mm !== null && e.min_width_mm !== undefined && e.max_width_mm !== undefined
                                ? `${e.min_width_mm}–${e.max_width_mm} mm`
                                : `${e.width_mm ?? "-"} mm`}
                            </td>
                            <td className="py-2 px-3 font-sans text-muted-foreground">{e.typical_finger || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {chartFormat === "shape_range" && (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-muted/40 font-sans font-semibold text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3">Nail Shape</th>
                          <th className="py-2.5 px-3">Length Min</th>
                          <th className="py-2.5 px-3">Length Max</th>
                          <th className="py-2.5 px-3">Width Min</th>
                          <th className="py-2.5 px-3">Width Max</th>
                          <th className="py-2.5 px-3">Thickness</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {entries.map((e, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-bold font-sans">{e.shape || e.size_label}</td>
                            <td className="py-2 px-3">{e.min_length_mm ?? "-"} mm</td>
                            <td className="py-2 px-3">{e.max_length_mm ?? "-"} mm</td>
                            <td className="py-2 px-3">{e.min_width_mm ?? "-"} mm</td>
                            <td className="py-2 px-3">{e.max_width_mm ?? "-"} mm</td>
                            <td className="py-2 px-3">{e.thickness_mm ?? "-"} mm</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {chartFormat === "length_only_numbered" && (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-muted/40 font-sans font-semibold text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3">Nail Shape</th>
                          <th className="py-2.5 px-2 text-center">#0</th>
                          <th className="py-2.5 px-2 text-center">#1</th>
                          <th className="py-2.5 px-2 text-center">#2</th>
                          <th className="py-2.5 px-2 text-center">#3</th>
                          <th className="py-2.5 px-2 text-center">#4</th>
                          <th className="py-2.5 px-2 text-center">#5</th>
                          <th className="py-2.5 px-2 text-center">#6</th>
                          <th className="py-2.5 px-2 text-center">#7</th>
                          <th className="py-2.5 px-2 text-center">#8</th>
                          <th className="py-2.5 px-2 text-center">#9</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {(() => {
                          const shapes = Array.from(new Set(entries.map((e) => e.shape || "Standard")));
                          return shapes.map((shp) => (
                            <tr key={shp}>
                              <td className="py-2 px-3 font-bold font-sans">{shp}</td>
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                                const entry = entries.find(
                                  (e) =>
                                    (e.shape || "Standard") === shp &&
                                    (e.size_label === `#${n}` || e.size_label === `${n}`)
                                );
                                return (
                                  <td key={n} className="py-2 px-2 text-center font-bold text-foreground">
                                    {entry?.length_mm != null ? `${entry.length_mm} mm` : "—"}
                                  </td>
                                );
                              })}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* EDITOR FORM */
              <div className="mt-6 space-y-6">
                {/* 1. Brand Profile Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="size-3.5" /> Brand Identity
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Brand Name *
                      </label>
                      <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="e.g. PRESSE, Joyee, Glamnetic"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        URL Slug (leave blank to auto-generate)
                      </label>
                      <input
                        type="text"
                        value={brandSlug}
                        onChange={(e) => setBrandSlug(e.target.value)}
                        placeholder="e.g. glamnetic"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Logo URL / Path
                      </label>
                      <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="e.g. /logos/presse.png or https://..."
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Brand Website
                      </label>
                      <input
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Nail Shapes (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={shapesInput}
                      onChange={(e) => setShapesInput(e.target.value)}
                      placeholder="Extra Short Round, Short Almond, Medium Square, Long Coffin..."
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Brand Description
                    </label>
                    <textarea
                      rows={2}
                      value={brandDescription}
                      onChange={(e) => setBrandDescription(e.target.value)}
                      placeholder="Summary of brand press-on collection..."
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                {/* 2. Chart Format & Configuration */}
                <div className="space-y-4 border-t border-border pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5" /> Sizing Chart Setup
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Chart Name *
                      </label>
                      <input
                        type="text"
                        value={chartName}
                        onChange={(e) => setChartName(e.target.value)}
                        placeholder="e.g. PRESSE Standard Sizing Guide"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Chart Format *
                      </label>
                      <select
                        value={chartFormat}
                        onChange={(e) => handleFormatChange(e.target.value as ChartFormatType)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:outline-none"
                      >
                        <option value="preset_set">Preset Sets (XS, S, M, L)</option>
                        <option value="numbered_size">Numbered Sizes (0–9)</option>
                        <option value="shape_range">Shape-Based Ranges</option>
                        <option value="length_only_numbered">Length-Only Numbered Guide (#0–#9)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Source URL
                      </label>
                      <input
                        type="text"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        placeholder="https://brand.com/size-guide"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Source Notes
                      </label>
                      <input
                        type="text"
                        value={sourceNotes}
                        onChange={(e) => setSourceNotes(e.target.value)}
                        placeholder="e.g. Extracted from official website size guide"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Verification Status
                      </label>
                      <select
                        value={verificationStatus}
                        onChange={(e) => setVerificationStatus(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none"
                      >
                        <option value="user_provided">User Provided Reference</option>
                        <option value="community_submitted">Community Submitted</option>
                        <option value="brand_verified">Brand Verified Official</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Dynamic Measurement Entries Table */}
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Measurements Table ({chartFormat.toUpperCase()})
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        All measurements are in {unit}. Do not convert missing values to 0.
                      </p>
                    </div>

                    <Button onClick={handleAddRow} size="sm" variant="outline" className="gap-1 text-xs">
                      <Plus className="size-3" />
                      Add Row
                    </Button>
                  </div>

                  {/* FORMAT A: PRESET SETS (XS, S, M, L) */}
                  {chartFormat === "preset_set" && (
                    <div className="overflow-x-auto rounded-2xl border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 font-semibold text-muted-foreground border-b border-border">
                          <tr>
                            <th className="py-2.5 px-3">Size Code</th>
                            <th className="py-2.5 px-2">Thumb (mm)</th>
                            <th className="py-2.5 px-2">Index (mm)</th>
                            <th className="py-2.5 px-2">Middle (mm)</th>
                            <th className="py-2.5 px-2">Ring (mm)</th>
                            <th className="py-2.5 px-2">Pinky (mm)</th>
                            <th className="py-2.5 px-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono">
                          {entries.map((e, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 font-sans">
                                <input
                                  type="text"
                                  value={e.size_label}
                                  onChange={(ev) => handleEntryChange(idx, "size_label", ev.target.value)}
                                  className="w-16 font-bold rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={e.thumb_width_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "thumb_width_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={e.index_width_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "index_width_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={e.middle_width_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "middle_width_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={e.ring_width_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "ring_width_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={e.pinky_width_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "pinky_width_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(idx)}
                                  className="p-1 rounded text-destructive hover:bg-destructive/10"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* FORMAT B: NUMBERED SIZES (0–9) */}
                  {chartFormat === "numbered_size" && (
                    <div className="overflow-x-auto rounded-2xl border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 font-semibold text-muted-foreground border-b border-border">
                          <tr>
                            <th className="py-2.5 px-3">Size #</th>
                            <th className="py-2.5 px-2">Width (mm)</th>
                            <th className="py-2.5 px-2">Min Width</th>
                            <th className="py-2.5 px-2">Max Width</th>
                            <th className="py-2.5 px-2 text-center">Approx (~)</th>
                            <th className="py-2.5 px-3">Typical Finger</th>
                            <th className="py-2.5 px-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono">
                          {entries.map((e, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 font-sans">
                                <input
                                  type="text"
                                  value={e.size_label}
                                  onChange={(ev) => handleEntryChange(idx, "size_label", ev.target.value)}
                                  className="w-14 font-bold rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={e.width_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "width_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  placeholder="e.g. 7"
                                  className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={e.min_width_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "min_width_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  placeholder="15.0"
                                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={e.max_width_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "max_width_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  placeholder="16.0"
                                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={Boolean(e.is_approximate)}
                                  onChange={(ev) => handleEntryChange(idx, "is_approximate", ev.target.checked)}
                                  className="rounded border-border"
                                />
                              </td>
                              <td className="py-2 px-3 font-sans">
                                <input
                                  type="text"
                                  value={e.typical_finger || ""}
                                  onChange={(ev) => handleEntryChange(idx, "typical_finger", ev.target.value)}
                                  placeholder="Pinky (petite), Thumb..."
                                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(idx)}
                                  className="p-1 rounded text-destructive hover:bg-destructive/10"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* FORMAT C: SHAPE RANGES */}
                  {chartFormat === "shape_range" && (
                    <div className="overflow-x-auto rounded-2xl border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 font-semibold text-muted-foreground border-b border-border">
                          <tr>
                            <th className="py-2.5 px-3">Nail Shape</th>
                            <th className="py-2.5 px-2">Len Min (mm)</th>
                            <th className="py-2.5 px-2">Len Max (mm)</th>
                            <th className="py-2.5 px-2">Wid Min (mm)</th>
                            <th className="py-2.5 px-2">Wid Max (mm)</th>
                            <th className="py-2.5 px-2">Thickness (mm)</th>
                            <th className="py-2.5 px-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono">
                          {entries.map((e, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 font-sans">
                                <input
                                  type="text"
                                  value={e.shape || e.size_label}
                                  onChange={(ev) => {
                                    handleEntryChange(idx, "shape", ev.target.value);
                                    handleEntryChange(idx, "size_label", ev.target.value);
                                  }}
                                  placeholder="Shape Name"
                                  className="w-36 font-semibold rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={e.min_length_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "min_length_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  className="w-18 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={e.max_length_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "max_length_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  className="w-18 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={e.min_width_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "min_width_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  className="w-18 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={e.max_width_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "max_width_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  className="w-18 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={e.thickness_mm ?? ""}
                                  onChange={(ev) => handleEntryChange(idx, "thickness_mm", ev.target.value ? parseFloat(ev.target.value) : null)}
                                  placeholder="0.6"
                                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(idx)}
                                  className="p-1 rounded text-destructive hover:bg-destructive/10"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* FORMAT E: LENGTH-ONLY NUMBERED MATRIX (#0–#9) */}
                  {chartFormat === "length_only_numbered" && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-purple-950 dark:text-purple-300">
                        <p className="font-semibold">
                          Length Specification Matrix (Cuticle to Tip, Unit: mm)
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          Configure #0 (longest) through #9 (shortest) for each shape. All lengths are stored in millimeters. Width measurements are omitted.
                        </p>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-border">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/40 font-semibold text-muted-foreground border-b border-border">
                            <tr>
                              <th className="py-2.5 px-3 min-w-[130px]">Shape Name</th>
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                <th key={n} className="py-2.5 px-1.5 text-center min-w-[50px]">
                                  #{n}
                                </th>
                              ))}
                              <th className="py-2.5 px-2 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono">
                            {(() => {
                              const shapes = Array.from(new Set(entries.map((e) => e.shape || "Short Oval")));
                              return shapes.map((shp) => (
                                <tr key={shp} className="hover:bg-muted/20 transition-colors">
                                  <td className="py-2 px-3 font-sans font-bold text-foreground">
                                    <input
                                      type="text"
                                      value={shp}
                                      onChange={(ev) => {
                                        const newName = ev.target.value;
                                        setEntries(
                                          entries.map((e) =>
                                            (e.shape || "Short Oval") === shp
                                              ? { ...e, shape: newName }
                                              : e
                                          )
                                        );
                                      }}
                                      className="w-32 font-bold rounded-lg border border-border bg-background px-2 py-1 text-xs"
                                    />
                                  </td>
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                                    const entry = entries.find(
                                      (e) =>
                                        (e.shape || "Short Oval") === shp &&
                                        (e.size_label === `#${n}` || e.size_label === `${n}`)
                                    );
                                    return (
                                      <td key={n} className="py-2 px-1 text-center">
                                        <input
                                          type="number"
                                          step="0.5"
                                          value={entry?.length_mm ?? ""}
                                          onChange={(ev) => {
                                            const val = ev.target.value ? parseFloat(ev.target.value) : null;
                                            const exists = entries.some(
                                              (e) =>
                                                (e.shape || "Short Oval") === shp &&
                                                (e.size_label === `#${n}` || e.size_label === `${n}`)
                                            );
                                            if (exists) {
                                              setEntries(
                                                entries.map((e) =>
                                                  (e.shape || "Short Oval") === shp &&
                                                  (e.size_label === `#${n}` || e.size_label === `${n}`)
                                                    ? { ...e, length_mm: val }
                                                    : e
                                                )
                                              );
                                            } else {
                                              setEntries([
                                                ...entries,
                                                {
                                                  shape: shp,
                                                  size_label: `#${n}`,
                                                  length_mm: val,
                                                  display_order: entries.length,
                                                },
                                              ]);
                                            }
                                          }}
                                          placeholder="mm"
                                          className="w-12 text-center rounded-lg border border-border bg-background px-1 py-1 text-xs font-bold"
                                        />
                                      </td>
                                    );
                                  })}
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEntries(entries.filter((e) => (e.shape || "Short Oval") !== shp));
                                      }}
                                      className="p-1 rounded text-destructive hover:bg-destructive/10"
                                      title="Remove shape and its 10 sizes"
                                    >
                                      <X className="size-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>

                      <Button
                        type="button"
                        onClick={() => {
                          const existingShapes = new Set(entries.map((e) => e.shape || "Short Oval"));
                          const shapeName = `New Shape ${existingShapes.size + 1}`;
                          const newRows: AdminChartEntryPayload[] = [];
                          for (let n = 0; n <= 9; n++) {
                            newRows.push({
                              shape: shapeName,
                              size_label: `#${n}`,
                              length_mm: 20,
                              display_order: entries.length + n,
                            });
                          }
                          setEntries([...entries, ...newRows]);
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs font-semibold"
                      >
                        <Plus className="size-3.5" />
                        Add Another Shape
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <Button onClick={() => setIsEditorOpen(false)} variant="ghost" size="sm">
                Cancel
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleSave("draft")}
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                >
                  Save as Draft
                </Button>
                <Button
                  onClick={() => handleSave("published")}
                  size="sm"
                  disabled={isSubmitting}
                  className="gap-2 shadow-soft"
                >
                  <Check className="size-4" />
                  {isSubmitting ? "Saving..." : "Save & Publish"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deletion */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="size-5" />
              Confirm Chart Deletion
            </h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete this brand sizing chart? This will also unpublish the brand from the public catalog. This action cannot be undone.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button onClick={() => setConfirmDeleteId(null)} variant="outline" size="sm">
                Cancel
              </Button>
              <Button onClick={handleDeleteChart} variant="destructive" size="sm">
                Yes, Delete Chart
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
