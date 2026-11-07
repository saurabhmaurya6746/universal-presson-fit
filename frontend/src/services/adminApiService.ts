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

  /**
   * IMPORTANT NOTICE:
   * GET /api/admin/audit-events is intentionally BLOCKED and NOT implemented in frontend.
   * Reason: Phase 5 has an unresolved audit-response sanitizer issue.
   * Exposing this endpoint is held pending separate Phase 5 correction and review.
   */
}

export const adminApiService = new AdminApiService();
