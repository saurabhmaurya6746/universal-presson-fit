import { API_BASE_URL, isRemoteApiEnabled } from "@/lib/apiConfig";
import { authAdapter } from "./authAdapter";

export interface FingerMeasurementEntry {
  finger: string;
  width_mm: number;
  height_mm?: number;
  recommended_size?: string;
  size?: string;
  hand?: "left" | "right";
  colorHex?: string;
}

export interface ApiMeasurementProfile {
  id: string;
  user_id?: string;
  profile_name: string;
  nickname: string;
  hand_side?: string;
  measurements: FingerMeasurementEntry[] | Record<string, number>;
  calibration_data?: Record<string, unknown>;
  summary_profile?: string;
  coin_verified?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface GetProfilesResult {
  success: boolean;
  profiles: ApiMeasurementProfile[];
  error?: string;
}

export interface CreateMeasurementProfileInput {
  nickname?: string;
  profile_name?: string;
  hand_side?: "left" | "right" | "both";
  measurements: FingerMeasurementEntry[];
  summary_profile?: string;
}

class MeasurementApiService {
  private async getAuthToken(): Promise<string | null> {
    return authAdapter.getAccessToken();
  }

  async getProfiles(): Promise<GetProfilesResult> {
    if (!isRemoteApiEnabled()) {
      return { success: false, profiles: [], error: "Remote API is disabled." };
    }

    const token = await this.getAuthToken();
    if (!token) {
      return { success: false, profiles: [], error: "Authentication required to load profiles." };
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/api/measurements/profiles`, {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        return {
          success: false,
          profiles: [],
          error: typeof body.detail === "string" ? body.detail : `Failed to load profiles (HTTP ${resp.status}).`,
        };
      }

      const data = await resp.json();
      return {
        success: true,
        profiles: Array.isArray(data) ? data : [],
      };
    } catch {
      return {
        success: false,
        profiles: [],
        error: "Network error loading measurement profiles.",
      };
    }
  }

  async createProfile(input: CreateMeasurementProfileInput): Promise<{ success: boolean; profile?: ApiMeasurementProfile; error?: string }> {
    if (!isRemoteApiEnabled()) {
      return { success: false, error: "Remote API is disabled." };
    }

    const token = await this.getAuthToken();
    if (!token) {
      return { success: false, error: "Authentication required to save profile." };
    }

    try {
      // Map measurements to conform to backend validation
      const items = (input.measurements || []).map((m) => {
        let cleanFinger = m.finger.trim();
        return {
          finger: cleanFinger,
          width_mm: Number(m.width_mm),
          size: m.size || m.recommended_size,
          hand: m.hand,
        };
      });

      const payload = {
        nickname: input.nickname || input.profile_name || "Natural Everyday Oval Fit",
        hand_side: input.hand_side || "right",
        measurements: items,
        summary_profile: input.summary_profile || undefined,
      };

      const resp = await fetch(`${API_BASE_URL}/api/measurements/profiles`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return { success: true, profile: body };
      }
      return {
        success: false,
        error: typeof body.detail === "string" ? body.detail : "Failed to create measurement profile.",
      };
    } catch {
      return { success: false, error: "Network error saving measurement profile." };
    }
  }

  async deleteProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
    if (!isRemoteApiEnabled()) {
      return { success: true };
    }

    const token = await this.getAuthToken();
    if (!token) return { success: false, error: "Not authenticated" };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/measurements/profiles/${encodeURIComponent(profileId)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.ok) return { success: true };
      const body = await resp.json().catch(() => ({}));
      return {
        success: false,
        error: typeof body.detail === "string" ? body.detail : "Failed to delete measurement profile.",
      };
    } catch {
      return { success: false, error: "Network error deleting measurement profile." };
    }
  }
}

export const measurementApiService = new MeasurementApiService();
