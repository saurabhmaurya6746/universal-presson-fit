import { API_BASE_URL, isRemoteApiEnabled } from "@/lib/apiConfig";
import { authAdapter } from "./authAdapter";

export interface AdminBrandItem {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  tagline?: string | null;
  description?: string | null;
  contact_person?: string | null;
  contact_email: string;
  website?: string | null;
  instagram?: string | null;
  city?: string | null;
  country: string;
  status: "pending_review" | "active" | "rejected" | "suspended";
  is_public: boolean;
  shapes: string[];
  created_at: string;
  updated_at: string;
  trial?: {
    id: string;
    brand_id: string;
    start_date: string;
    end_date: string;
    status: string;
    renewal_intent?: string;
    selected_plan?: string;
    notes?: string | null;
    days_remaining?: number;
    is_expired?: boolean;
  } | null;
}

export interface AdminTrialInfo {
  id: string;
  brand_id: string;
  start_date: string;
  end_date: string;
  status: string;
  renewal_intent: string;
  selected_plan: string;
  notes?: string | null;
  days_remaining: number;
  is_expired: boolean;
}

export interface AdminUserItem {
  id: string;
  email: string;
  full_name?: string | null;
  role: "personal" | "brand" | "admin";
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface AdminSizingChartListItem {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_logo_url?: string | null;
  is_official: boolean;
  chart_name: string;
  format: string;
  unit: string;
  status: "draft" | "published";
  is_public: boolean;
  version: number;
  entry_count: number;
  shapes_count: number;
  source_url?: string | null;
  verification_status: string;
  updated_at: string;
}

export interface AdminChartEntryPayload {
  id?: string;
  size_label: string;
  shape?: string | null;
  finger?: string | null;
  typical_finger?: string | null;
  width_mm?: number | null;
  length_mm?: number | null;
  min_width_mm?: number | null;
  max_width_mm?: number | null;
  min_length_mm?: number | null;
  max_length_mm?: number | null;
  thickness_mm?: number | null;
  is_approximate?: boolean;
  thumb_width_mm?: number | null;
  index_width_mm?: number | null;
  middle_width_mm?: number | null;
  ring_width_mm?: number | null;
  pinky_width_mm?: number | null;
  display_order?: number;
}

export interface AdminCreateBrandChartPayload {
  brand_id?: string;
  brand_name?: string;
  brand_slug?: string;
  brand_description?: string;
  brand_tagline?: string;
  logo_url?: string;
  website?: string;
  contact_email?: string;
  shapes?: string[];
  chart_name: string;
  format: string;
  unit?: string;
  status: "draft" | "published";
  is_public: boolean;
  custom_notes?: string;
  source_url?: string;
  source_notes?: string;
  verification_status?: string;
  entries: AdminChartEntryPayload[];
}

export interface AdminChartDetailResponse {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_logo_url?: string | null;
  brand_description?: string | null;
  brand_website?: string | null;
  brand_shapes: string[];
  is_official: boolean;
  chart_name: string;
  format: string;
  unit: string;
  status: string;
  is_public: boolean;
  custom_notes?: string | null;
  source_url?: string | null;
  source_notes?: string | null;
  verification_status: string;
  version: number;
  entries: AdminChartEntryPayload[];
  created_at: string;
  updated_at: string;
}

class AdminApiService {
  private async getAuthToken(): Promise<string | null> {
    return authAdapter.getAccessToken();
  }

  async listBrands(params?: { status?: string; search?: string }): Promise<AdminBrandItem[]> {
    if (!isRemoteApiEnabled()) return [];
    const token = await this.getAuthToken();
    if (!token) return [];

    const searchParams = new URLSearchParams();
    if (params?.status && params.status !== "all") searchParams.set("status", params.status);
    if (params?.search) searchParams.set("search", params.search);

    const qs = searchParams.toString();
    const url = `${API_BASE_URL}/api/admin/brands${qs ? `?${qs}` : ""}`;

    try {
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!resp.ok) return [];
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async approveBrand(brandId: string, adminNotes?: string): Promise<{ success: boolean; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/brands/${encodeURIComponent(brandId)}/approve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ admin_notes: adminNotes || undefined }),
      });

      if (resp.ok) return { success: true };
      const body = await resp.json().catch(() => ({}));
      return { success: false, error: body.detail || "Failed to approve brand." };
    } catch {
      return { success: false, error: "Network error approving brand." };
    }
  }

  async rejectBrand(brandId: string, reason?: string, adminNotes?: string): Promise<{ success: boolean; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/brands/${encodeURIComponent(brandId)}/reject`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: reason || undefined,
          admin_notes: adminNotes || undefined,
        }),
      });

      if (resp.ok) return { success: true };
      const body = await resp.json().catch(() => ({}));
      return { success: false, error: body.detail || "Failed to reject brand." };
    } catch {
      return { success: false, error: "Network error rejecting brand." };
    }
  }

  async suspendBrand(brandId: string, reason?: string, adminNotes?: string): Promise<{ success: boolean; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/brands/${encodeURIComponent(brandId)}/suspend`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: reason || undefined,
          admin_notes: adminNotes || undefined,
        }),
      });

      if (resp.ok) return { success: true };
      const body = await resp.json().catch(() => ({}));
      return { success: false, error: body.detail || "Failed to suspend brand." };
    } catch {
      return { success: false, error: "Network error suspending brand." };
    }
  }

  async reactivateBrand(brandId: string, adminNotes?: string): Promise<{ success: boolean; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/brands/${encodeURIComponent(brandId)}/reactivate`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ admin_notes: adminNotes || undefined }),
      });

      if (resp.ok) return { success: true };
      const body = await resp.json().catch(() => ({}));
      return { success: false, error: body.detail || "Failed to reactivate brand." };
    } catch {
      return { success: false, error: "Network error reactivating brand." };
    }
  }

  async getTrial(brandId: string): Promise<AdminTrialInfo | null> {
    const token = await this.getAuthToken();
    if (!token) return null;

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/trials/${encodeURIComponent(brandId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (resp.ok) return (await resp.json()) as AdminTrialInfo;
      return null;
    } catch {
      return null;
    }
  }

  async updateTrial(
    brandId: string,
    updates: {
      status?: string;
      end_date?: string;
      selected_plan?: string;
      renewal_intent?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; trial?: AdminTrialInfo; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/trials/${encodeURIComponent(brandId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) return { success: true, trial: body };
      return { success: false, error: body.detail || "Failed to update trial." };
    } catch {
      return { success: false, error: "Network error updating trial." };
    }
  }

  async listAccounts(params?: { role?: string; is_active?: boolean; search?: string }): Promise<AdminUserItem[]> {
    const token = await this.getAuthToken();
    if (!token) return [];

    const searchParams = new URLSearchParams();
    if (params?.role) searchParams.set("role", params.role);
    if (params?.is_active !== undefined) searchParams.set("is_active", String(params.is_active));
    if (params?.search) searchParams.set("search", params.search);

    const qs = searchParams.toString();
    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/accounts${qs ? `?${qs}` : ""}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (resp.ok) return (await resp.json()) as AdminUserItem[];
      return [];
    } catch {
      return [];
    }
  }

  async updateAccountStatusOrRole(
    userId: string,
    updates: { role?: "personal" | "brand" | "admin"; is_active?: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/accounts/${encodeURIComponent(userId)}/status-or-role`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) return { success: true };
      return { success: false, error: body.detail || "Failed to update account status or role." };
    } catch {
      return { success: false, error: "Network error updating account." };
    }
  }

  async listSizingCharts(params?: {
    format?: string;
    status?: string;
    search?: string;
    is_official?: boolean;
  }): Promise<AdminSizingChartListItem[]> {
    if (!isRemoteApiEnabled()) return [];
    const token = await this.getAuthToken();
    if (!token) return [];

    const searchParams = new URLSearchParams();
    if (params?.format && params.format !== "all") searchParams.set("format", params.format);
    if (params?.status && params.status !== "all") searchParams.set("status", params.status);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.is_official !== undefined) searchParams.set("is_official", String(params.is_official));

    const qs = searchParams.toString();
    const url = `${API_BASE_URL}/api/admin/sizing-charts${qs ? `?${qs}` : ""}`;

    try {
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async getSizingChart(chartId: string): Promise<AdminChartDetailResponse | null> {
    const token = await this.getAuthToken();
    if (!token) return null;

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/sizing-charts/${encodeURIComponent(chartId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  async createSizingChart(
    payload: AdminCreateBrandChartPayload
  ): Promise<{ success: boolean; data?: AdminChartDetailResponse; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/sizing-charts`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) return { success: true, data: body };
      return { success: false, error: body.detail || "Failed to create sizing chart." };
    } catch {
      return { success: false, error: "Network error creating sizing chart." };
    }
  }

  async updateSizingChart(
    chartId: string,
    payload: Partial<AdminCreateBrandChartPayload>
  ): Promise<{ success: boolean; data?: AdminChartDetailResponse; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/sizing-charts/${encodeURIComponent(chartId)}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) return { success: true, data: body };
      return { success: false, error: body.detail || "Failed to update sizing chart." };
    } catch {
      return { success: false, error: "Network error updating sizing chart." };
    }
  }

  async togglePublishChart(
    chartId: string,
    action: "publish" | "unpublish"
  ): Promise<{ success: boolean; data?: AdminChartDetailResponse; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/admin/sizing-charts/${encodeURIComponent(chartId)}/publish?action=${encodeURIComponent(action)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) return { success: true, data: body };
      return { success: false, error: body.detail || `Failed to ${action} sizing chart.` };
    } catch {
      return { success: false, error: `Network error toggling publish state.` };
    }
  }

  async deleteSizingChart(
    chartId: string,
    deleteBrand = false
  ): Promise<{ success: boolean; error?: string }> {
    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/admin/sizing-charts/${encodeURIComponent(chartId)}?delete_brand=${deleteBrand}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) return { success: true };
      return { success: false, error: body.detail || "Failed to delete sizing chart." };
    } catch {
      return { success: false, error: "Network error deleting sizing chart." };
    }
  }

  /**
   * IMPORTANT NOTICE:
   * GET /api/admin/audit-events is intentionally BLOCKED and NOT implemented in frontend.
   * Reason: Phase 5 has an unresolved audit-response sanitizer issue.
   * Exposing this endpoint is held pending separate Phase 5 correction and review.
   */
}

export const adminApiService = new AdminApiService();
