import { API_BASE_URL, isRemoteApiEnabled } from "@/lib/apiConfig";
import { authAdapter } from "./authAdapter";
import { getBrands, updateBrandChart } from "./brandService";
import type { FingerWidthMap, NailWidthRange } from "@/types/brand";

export interface BrandApplyData {
  name: string;
  tagline?: string;
  description?: string;
  contact_person: string;
  contact_email: string;
  website?: string;
  instagram?: string;
  city?: string;
  country?: string;
  shapes?: string[];
}

export interface RealBrandTrial {
  id: string;
  brand_id: string;
  start_date: string;
  end_date: string;
  status: "active" | "ending_soon" | "expired" | "extended" | "converted";
  renewal_intent: "yes" | "no" | "pending" | "not_asked";
  selected_plan: string;
  notes?: string | null;
}

export interface RealBrandProfile {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  contact_person: string | null;
  contact_email: string;
  website: string | null;
  instagram: string | null;
  city: string | null;
  country: string;
  status: "active" | "pending_review" | "rejected" | "suspended" | "demo_sample";
  is_public: boolean;
  shapes: string[];
  created_at: string;
  updated_at: string;
  trial?: RealBrandTrial | null;
}

export interface DbChartEntry {
  id?: string;
  chart_id?: string;
  size_label: string;
  thumb_width_mm?: number | null;
  index_width_mm?: number | null;
  middle_width_mm?: number | null;
  ring_width_mm?: number | null;
  pinky_width_mm?: number | null;
  min_width_mm?: number | null;
  max_width_mm?: number | null;
  display_order: number;
}

export interface DbSizingChart {
  id: string;
  brand_id: string;
  chart_name: string;
  format: "per_size" | "width_ranges";
  unit: "mm";
  status: "draft" | "published";
  is_public: boolean;
  custom_notes: string | null;
  source_type: "manual" | "csv_upload" | "json_upload" | "preset";
  version: number;
  created_at: string;
  updated_at: string;
  sizing_chart_entries?: DbChartEntry[];
}

export interface ChartValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ChartPayload {
  chart_name: string;
  format: "per_size" | "width_ranges";
  status: "draft" | "published";
  is_public: boolean;
  custom_notes?: string;
  source_type?: "manual" | "csv_upload" | "json_upload" | "preset";
  per_size_entries?: Array<{
    size_label: string;
    thumb_width_mm: number;
    index_width_mm: number;
    middle_width_mm: number;
    ring_width_mm: number;
    pinky_width_mm: number;
  }>;
  width_range_entries?: Array<{
    size_label: string;
    min_width_mm: number;
    max_width_mm: number;
  }>;
}

/**
 * Validates sizing chart data on the client side according to Phase 3 requirements.
 * Validates required values, positive mm, duplicate labels, reversed ranges, overlaps and gaps.
 */
export function validateChartPayloadLocally(payload: ChartPayload): ChartValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!payload.chart_name || !payload.chart_name.trim()) {
    errors.push("Chart name is required.");
  }

  if (payload.format === "per_size") {
    const entries = payload.per_size_entries || [];
    if (entries.length === 0) {
      errors.push("At least one size row is required for a per-size chart.");
    } else {
      const labels = new Set<string>();
      entries.forEach((entry, idx) => {
        const label = entry.size_label.trim();
        if (!label) {
          errors.push(`Row ${idx + 1}: Size label is required.`);
        } else if (labels.has(label.toLowerCase())) {
          errors.push(`Duplicate size label "${label}" detected.`);
        } else {
          labels.add(label.toLowerCase());
        }

        const fingers: Array<[string, number]> = [
          ["Thumb", entry.thumb_width_mm],
          ["Index", entry.index_width_mm],
          ["Middle", entry.middle_width_mm],
          ["Ring", entry.ring_width_mm],
          ["Pinky", entry.pinky_width_mm],
        ];

        fingers.forEach(([fname, val]) => {
          if (val === undefined || val === null || isNaN(val) || val <= 0) {
            errors.push(`Row "${label || idx + 1}" (${fname}): Width must be greater than 0 mm.`);
          } else if (val > 35) {
            warnings.push(`Row "${label || idx + 1}" (${fname}): ${val} mm seems unusually wide for a natural nail.`);
          }
        });
      });
    }
  } else if (payload.format === "width_ranges") {
    const entries = payload.width_range_entries || [];
    if (entries.length === 0) {
      errors.push("At least one range entry is required for a width-range chart.");
    } else {
      const labels = new Set<string>();
      const sortedRanges: Array<{ min: number; max: number; label: string }> = [];

      entries.forEach((entry, idx) => {
        const label = entry.size_label.trim();
        if (!label) {
          errors.push(`Row ${idx + 1}: Size label is required.`);
        } else if (labels.has(label.toLowerCase())) {
          errors.push(`Duplicate size label "${label}" detected.`);
        } else {
          labels.add(label.toLowerCase());
        }

        if (entry.min_width_mm <= 0) {
          errors.push(`Row "${label || idx + 1}": Minimum width must be greater than 0 mm.`);
        }
        if (entry.max_width_mm <= 0) {
          errors.push(`Row "${label || idx + 1}": Maximum width must be greater than 0 mm.`);
        }
        if (entry.min_width_mm >= entry.max_width_mm) {
          errors.push(`Row "${label || idx + 1}": Minimum width (${entry.min_width_mm} mm) cannot be greater than or equal to maximum width (${entry.max_width_mm} mm).`);
        }

        sortedRanges.push({ min: entry.min_width_mm, max: entry.max_width_mm, label });
      });

      // Check overlaps and gaps
      sortedRanges.sort((a, b) => a.min - b.min);
      for (let i = 0; i < sortedRanges.length - 1; i++) {
        const cur = sortedRanges[i];
        const next = sortedRanges[i + 1];
        if (cur.max > next.min) {
          warnings.push(`Overlap detected between "${cur.label}" (${cur.min}–${cur.max} mm) and "${next.label}" (${next.min}–${next.max} mm).`);
        } else if (next.min - cur.max > 0.5) {
          warnings.push(`Gap detected between "${cur.label}" (max ${cur.max} mm) and "${next.label}" (min ${next.min} mm).`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

class BrandApiService {
  private async getCurrentBrandId(): Promise<string | null> {
    const user = await authAdapter.getCurrentUser();
    return user?.brandId || null;
  }

  private async getAuthToken(): Promise<string | null> {
    return authAdapter.getAccessToken();
  }

  /**
   * Submit brand partner application.
   */
  async applyForBrand(data: BrandApplyData): Promise<{ success: boolean; message?: string; brandId?: string; error?: string }> {
    if (!isRemoteApiEnabled()) {
      return {
        success: true,
        message: "Studio partner application received in demo preview mode.",
      };
    }

    const token = await this.getAuthToken();
    if (!token) {
      return { success: false, error: "Authentication required to apply for a brand." };
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/api/brands/apply`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return {
          success: true,
          message: body.message || "Application submitted successfully.",
          brandId: body.brand?.id,
        };
      }
      return {
        success: false,
        error: typeof body.detail === "string" ? body.detail : body.message || "Failed to submit brand application.",
      };
    } catch {
      return {
        success: false,
        error: "Network error connecting to brand API. Please verify the backend server is running.",
      };
    }
  }

  /**
   * Get brand profile for the currently signed-in brand user.
   */
  async getMyBrand(): Promise<RealBrandProfile | null> {
    if (!isRemoteApiEnabled()) {
      const demoBrands = getBrands();
      const b = demoBrands[0];
      if (!b) return null;
      return {
        id: b.id,
        owner_id: "demo-owner",
        name: b.name,
        slug: b.slug,
        tagline: b.tagline,
        description: b.description,
        contact_person: b.contactPerson || "Studio Owner",
        contact_email: b.contactEmail,
        website: b.website || null,
        instagram: b.instagram || null,
        city: b.location,
        country: "India",
        status: b.status,
        is_public: b.profileVisibility === "public",
        shapes: b.shapes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const token = await this.getAuthToken();
    if (!token) return null;
    const brandId = await this.getCurrentBrandId();
    if (!brandId) return null;

    try {
      const resp = await fetch(`${API_BASE_URL}/api/brands/by-id/${encodeURIComponent(brandId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (resp.ok) {
        return (await resp.json()) as RealBrandProfile;
      }
    } catch {
      // Backend error
    }
    return null;
  }

  /**
   * Update brand profile fields.
   */
  async updateMyBrand(updates: Partial<RealBrandProfile>): Promise<{ success: boolean; error?: string }> {
    if (!isRemoteApiEnabled()) {
      return { success: true };
    }

    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const brandId = await this.getCurrentBrandId();
    if (!brandId) return { success: false, error: "Brand membership not found" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/brands/by-id/${encodeURIComponent(brandId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return { success: true };
      }
      return {
        success: false,
        error: typeof body.detail === "string" ? body.detail : "Failed to update brand profile.",
      };
    } catch {
      return { success: false, error: "Network error connecting to brand API." };
    }
  }

  /**
   * List all sizing charts for caller's brand.
   */
  async getMyCharts(): Promise<DbSizingChart[]> {
    if (!isRemoteApiEnabled()) {
      const demoBrands = getBrands();
      const b = demoBrands[0];
      if (!b) return [];

      const isRanges = b.sizingChart.format === "width_ranges";
      const entries: DbChartEntry[] = isRanges
        ? (b.sizingChart.ranges || []).map((r, i) => ({
            size_label: r.sizeLabel,
            min_width_mm: r.minMm,
            max_width_mm: r.maxMm,
            display_order: i,
          }))
        : Object.entries(b.sizingChart.sizes || {}).map(([sz, dims], i) => ({
            size_label: sz,
            thumb_width_mm: dims.thumb,
            index_width_mm: dims.index,
            middle_width_mm: dims.middle,
            ring_width_mm: dims.ring,
            pinky_width_mm: dims.pinky,
            display_order: i,
          }));

      return [
        {
          id: b.sizingChart.id,
          brand_id: b.id,
          chart_name: b.sizingChart.chartName,
          format: isRanges ? "width_ranges" : "per_size",
          unit: "mm",
          status: "published",
          is_public: b.chartVisibility !== "hidden",
          custom_notes: b.sizingChart.customNotes || null,
          source_type: b.sizingChart.sourceType || "manual",
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: b.sizingChart.updatedDate,
          sizing_chart_entries: entries,
        },
      ];
    }

    const token = await this.getAuthToken();
    if (!token) return [];
    const brandId = await this.getCurrentBrandId();
    if (!brandId) return [];

    try {
      const resp = await fetch(`${API_BASE_URL}/api/brands/${encodeURIComponent(brandId)}/charts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (resp.ok) {
        return (await resp.json()) as DbSizingChart[];
      }
    } catch {
      // Backend error
    }
    return [];
  }

  /**
   * Save (create or update) sizing chart.
   */
  async saveChart(
    payload: ChartPayload,
    chartId?: string
  ): Promise<{ success: boolean; chart?: DbSizingChart; warnings?: string[]; error?: string }> {
    const localVal = validateChartPayloadLocally(payload);
    if (payload.status === "published" && !localVal.valid) {
      return {
        success: false,
        error: localVal.errors.join(" "),
        warnings: localVal.warnings,
      };
    }

    if (!isRemoteApiEnabled()) {
      const demoBrands = getBrands();
      const b = demoBrands[0];
      if (!b) return { success: false, error: "No demo brand found." };

      const isRanges = payload.format === "width_ranges";
      const sizes: Record<string, FingerWidthMap> = {};
      const ranges: NailWidthRange[] = [];

      if (isRanges) {
        payload.width_range_entries?.forEach((entry) => {
          ranges.push({
            sizeLabel: entry.size_label,
            minMm: entry.min_width_mm,
            maxMm: entry.max_width_mm,
          });
        });
      } else {
        payload.per_size_entries?.forEach((entry) => {
          sizes[entry.size_label] = {
            thumb: entry.thumb_width_mm,
            index: entry.index_width_mm,
            middle: entry.middle_width_mm,
            ring: entry.ring_width_mm,
            pinky: entry.pinky_width_mm,
          };
        });
      }

      updateBrandChart(b.id, {
        ...b.sizingChart,
        chartName: payload.chart_name,
        format: isRanges ? "width_ranges" : "per_size_fingers",
        customNotes: payload.custom_notes,
        sizes,
        ranges,
        sourceType: payload.source_type || "manual",
      });

      return {
        success: true,
        warnings: localVal.warnings,
      };
    }

    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    const brandId = await this.getCurrentBrandId();
    if (!brandId) return { success: false, error: "Brand membership not found" };

    try {
      const url = chartId
        ? `${API_BASE_URL}/api/brands/${encodeURIComponent(brandId)}/charts/${encodeURIComponent(chartId)}`
        : `${API_BASE_URL}/api/brands/${encodeURIComponent(brandId)}/charts`;
      const method = chartId ? "PUT" : "POST";

      const resp = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return {
          success: true,
          chart: body.chart,
          warnings: body.warnings || localVal.warnings,
        };
      }
      const errorDetail = typeof body.detail === "string" ? body.detail : body.detail?.message || "Failed to save chart.";
      return { success: false, error: errorDetail };
    } catch {
      return { success: false, error: "Network error saving sizing chart." };
    }
  }

  /**
   * Delete a sizing chart.
   *
   * PRESERVES NON-DESTRUCTIVE SEMANTICS:
   * The backend returns HTTP 400 with:
   * "Chart deletion is disabled pending product policy decision. Sizing charts cannot be destructively deleted."
   * Surfaces the policy error to the UI and never performs destructive deletion.
   */
  async deleteChart(chartId: string): Promise<{ success: boolean; error?: string }> {
    if (!isRemoteApiEnabled()) {
      return { success: true };
    }

    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };
    const brandId = await this.getCurrentBrandId();
    if (!brandId) return { success: false, error: "Brand membership not found" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/brands/${encodeURIComponent(brandId)}/charts/${encodeURIComponent(chartId)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return { success: true };
      }
      return {
        success: false,
        error: typeof body.detail === "string" ? body.detail : "Chart deletion is disabled pending product policy decision.",
      };
    } catch {
      return {
        success: false,
        error: "Network error executing delete request.",
      };
    }
  }
}

export const brandApiService = new BrandApiService();
