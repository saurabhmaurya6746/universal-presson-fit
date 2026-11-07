import {
  API_BASE_URL,
  getStoredAccessToken,
  setStoredAccessToken,
  clearStoredAccessToken,
  isRemoteApiEnabled,
  getApiConfigStatus,
} from "@/lib/apiConfig";
import {
  AuthUser,
  getBrandPortalPath,
  UserRole,
  LoginResult,
  loginUser as demoLoginUser,
  logout as demoLogout,
  registerPersonalAccount as demoRegisterPersonal,
  registerBrandAccount as demoRegisterBrand,
  getCurrentUser as demoGetCurrentUser,
  RegisterPersonalParams,
  RegisterBrandParams,
} from "./authService";

/**
 * Authentication Adapter Interface
 *
 * Isolates UI components from the underlying authentication implementation.
 * Connects to FastAPI application auth endpoints when remote API is active.
 * Otherwise, falls back to DemoAuthAdapter without network calls.
 */
export interface AuthAdapter {
  isRemoteEnabled(): boolean;
  getStatus(): { configured: boolean; authEnabled: boolean; message: string };
  getCurrentUser(): Promise<AuthUser | null>;
  getAccessToken(): Promise<string | null>;
  login(email: string, password?: string): Promise<LoginResult>;
  logout(): Promise<void>;
  registerPersonal(params: RegisterPersonalParams, password?: string): Promise<LoginResult>;
  registerBrand(params: RegisterBrandParams, password?: string): Promise<LoginResult>;
  sendPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string }>;
  updatePassword(newPassword: string): Promise<{ success: boolean; message?: string; error?: string }>;
  verifyEmail?(token: string): Promise<{ success: boolean; message?: string; error?: string }>;
}

/**
 * Format technical errors into friendly user messages
 */
export function formatAuthError(error: unknown): string {
  if (!error) return "An unexpected authentication error occurred.";

  let raw = "";

  if (typeof error === "string") {
    raw = error;
  } else if (error instanceof Error) {
    raw = error.message;
  } else if (Array.isArray(error)) {
    // Pydantic validation error list, e.g. [{ loc: [...], msg: "String should have at least 8 characters" }]
    const messages = error
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          if ("msg" in item && typeof item.msg === "string") {
            const field = Array.isArray((item as { loc?: unknown[] }).loc)
              ? (item as { loc: unknown[] }).loc.filter((l) => l !== "body").join(" ")
              : "";
            return field ? `${field}: ${item.msg}` : item.msg;
          }
          if ("message" in item && typeof item.message === "string") return item.message;
        }
        return JSON.stringify(item);
      })
      .filter(Boolean);
    raw = messages.join(". ") || "Validation error occurred.";
  } else if (typeof error === "object" && error !== null) {
    if ("detail" in error) {
      return formatAuthError((error as { detail: unknown }).detail);
    }
    if ("message" in error && typeof (error as { message: unknown }).message === "string") {
      raw = (error as { message: string }).message;
    } else {
      try {
        raw = JSON.stringify(error);
      } catch {
        raw = "An unexpected error occurred.";
      }
    }
  } else {
    raw = String(error);
  }

  // Fallback if raw resolved to [object Object] or empty string
  if (!raw || raw === "[object Object]") {
    raw = "An unexpected error occurred. Please verify your details and try again.";
  }

  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials") || lower.includes("invalid email or password")) {
    return "Invalid email or password. Please verify your credentials and try again.";
  }
  if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed") || lower.includes("not verified")) {
    return "Your email address has not been confirmed yet. Please check your inbox for the confirmation link.";
  }
  if (lower.includes("already registered") || lower.includes("user_already_exists") || lower.includes("already exists") || lower.includes("conflict")) {
    return "An account with this email address already exists. Please sign in instead.";
  }
  if (lower.includes("at least 8") || lower.includes("at least 6") || lower.includes("weak_password") || lower.includes("too short") || lower.includes("string_too_short")) {
    return "Password is too short. Please use at least 8 characters.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Too many requests. Please wait a moment before trying again.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("timeout")) {
    return "Network connection to the authentication server failed. Please check your internet connection.";
  }
  return raw;
}

/**
 * Demo Auth Adapter
 * Backed by localStorage demo state without network requests.
 */
export class DemoAuthAdapter implements AuthAdapter {
  isRemoteEnabled(): boolean {
    return false;
  }

  getStatus() {
    const config = getApiConfigStatus();
    return {
      configured: config.configured,
      authEnabled: false,
      message: config.statusMessage,
    };
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return demoGetCurrentUser();
  }

  async getAccessToken(): Promise<string | null> {
    return null;
  }

  async login(email: string, password?: string): Promise<LoginResult> {
    return demoLoginUser(email, password);
  }

  async logout(): Promise<void> {
    demoLogout();
  }

  async registerPersonal(params: RegisterPersonalParams): Promise<LoginResult> {
    return demoRegisterPersonal(params);
  }

  async registerBrand(params: RegisterBrandParams): Promise<LoginResult> {
    return demoRegisterBrand(params);
  }

  async sendPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!email.trim()) {
      return { success: false, error: "Please enter your email address." };
    }
    return {
      success: true,
      message: "In demo mode, password reset simulation is recorded. (No email is sent).",
    };
  }

  async updatePassword(_newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return {
      success: true,
      message: "Password updated successfully in demo session.",
    };
  }
}

/**
 * FastAPI Auth Adapter
 *
 * Implements full session lifecycle, token refresh rotation, and DB-backed authorization.
 */
export class FastApiAuthAdapter implements AuthAdapter {
  private demoAdapter = new DemoAuthAdapter();
  private _activeRefreshPromise: Promise<string | null> | null = null;
  private _activeCurrentUserPromise: Promise<AuthUser | null> | null = null;

  isRemoteEnabled(): boolean {
    return isRemoteApiEnabled();
  }

  getStatus() {
    const config = getApiConfigStatus();
    return {
      configured: config.configured,
      authEnabled: config.apiEnabled,
      message: config.statusMessage,
    };
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.isRemoteEnabled()) return null;
    let token = getStoredAccessToken();
    if (token) return token;

    // Coalesce concurrent refresh requests to avoid duplicate rotation and token reuse detection
    if (this._activeRefreshPromise) {
      return this._activeRefreshPromise;
    }

    this._activeRefreshPromise = (async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.access_token) {
            setStoredAccessToken(data.access_token);
            return data.access_token;
          }
        }
      } catch {
        // Refresh failed
      } finally {
        this._activeRefreshPromise = null;
      }
      return null;
    })();

    return this._activeRefreshPromise;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!this.isRemoteEnabled()) {
      return this.demoAdapter.getCurrentUser();
    }

    // Coalesce concurrent user lookups to prevent duplicate /api/auth/me requests
    if (this._activeCurrentUserPromise) {
      return this._activeCurrentUserPromise;
    }

    this._activeCurrentUserPromise = (async () => {
      try {
        let token = await this.getAccessToken();

        if (token) {
          const resp = await fetch(`${API_BASE_URL}/api/auth/me`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          });

          if (resp.ok) {
            const userProfile = await resp.json();
            return {
              id: userProfile.id,
              email: userProfile.email || "",
              name: userProfile.full_name || userProfile.email?.split("@")[0] || "User",
              role: (userProfile.role as UserRole) || "personal",
              brandId: userProfile.brand_id || undefined,
              brandName: userProfile.brand_name || undefined,
              isDemoSession: false,
            };
          }

          // Token might be expired, try refreshing
          if (resp.status === 401) {
            clearStoredAccessToken();
            const refreshedToken = await this.getAccessToken();
            if (refreshedToken) {
              const retryResp = await fetch(`${API_BASE_URL}/api/auth/me`, {
                headers: {
                  Authorization: `Bearer ${refreshedToken}`,
                  "Content-Type": "application/json",
                },
                credentials: "include",
              });
              if (retryResp.ok) {
                const userProfile = await retryResp.json();
                return {
                  id: userProfile.id,
                  email: userProfile.email || "",
                  name: userProfile.full_name || userProfile.email?.split("@")[0] || "User",
                  role: (userProfile.role as UserRole) || "personal",
                  brandId: userProfile.brand_id || undefined,
                  brandName: userProfile.brand_name || undefined,
                  isDemoSession: false,
                };
              }
            }
          }
        }
        return null;
      } catch {
        return null;
      } finally {
        this._activeCurrentUserPromise = null;
      }
    })();

    return this._activeCurrentUserPromise;
  }

  async login(email: string, password?: string): Promise<LoginResult> {
    if (!this.isRemoteEnabled()) {
      return this.demoAdapter.login(email, password);
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password || "",
        }),
      });

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return { success: false, error: formatAuthError(body.detail || body.message || "Failed to sign in.") };
      }

      if (body.access_token) {
        setStoredAccessToken(body.access_token);
      }

      const userProfile = body.user;
      const currentUser: AuthUser = {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.full_name || userProfile.email.split("@")[0] || "User",
        role: (userProfile.role as UserRole) || "personal",
        brandId: userProfile.brand_id || undefined,
        brandName: userProfile.brand_name || undefined,
        isDemoSession: false,
      };

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("pressonfit_auth_change"));
      }

      const redirectTo =
        currentUser.role === "admin"
          ? "/admin"
          : currentUser.role === "brand"
          ? getBrandPortalPath(currentUser.brandId)
          : "/account";

      return { success: true, user: currentUser, redirectTo };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  async logout(): Promise<void> {
    if (this.isRemoteEnabled()) {
      try {
        const token = getStoredAccessToken();
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    clearStoredAccessToken();
    await this.demoAdapter.logout();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pressonfit_auth_change"));
    }
  }

  async registerPersonal(params: RegisterPersonalParams, password?: string): Promise<LoginResult> {
    if (!this.isRemoteEnabled()) {
      return this.demoAdapter.registerPersonal(params);
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.email.trim().toLowerCase(),
          password: password || "",
          full_name: params.name.trim(),
        }),
      });

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return { success: false, error: formatAuthError(body.detail || body.message || "Registration failed.") };
      }

      const userProfile = body.user;
      const user: AuthUser = {
        id: userProfile.id,
        email: userProfile.email || params.email,
        name: userProfile.full_name || params.name.trim(),
        role: "personal",
        isDemoSession: false,
      };

      return {
        success: true,
        user,
        redirectTo: "/login",
        verificationRequired: body.verification_required ?? false,
        message: body.message,
      };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  async registerBrand(params: RegisterBrandParams, password?: string): Promise<LoginResult> {
    if (!this.isRemoteEnabled()) {
      return this.demoAdapter.registerBrand(params);
    }

    try {
      const cleanEmail = params.businessEmail.trim().toLowerCase();
      if (!cleanEmail) {
        return { success: false, error: "Please enter your business email." };
      }
      if (!password || password.length < 8) {
        return { success: false, error: "Password must be at least 8 characters long." };
      }

      // 1. Register account
      const regResp = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          full_name: params.contactName.trim(),
        }),
      });

      const regBody = await regResp.json().catch(() => ({}));
      if (!regResp.ok) {
        return { success: false, error: formatAuthError(regBody.detail || regBody.message || "Registration failed.") };
      }

      // 2. Log in to establish session
      const loginResp = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
        }),
      });

      const loginBody = await loginResp.json().catch(() => ({}));
      if (!loginResp.ok || !loginBody.access_token) {
        // If email confirmation is strictly enforced
        return {
          success: true,
          redirectTo: "/login",
        };
      }

      setStoredAccessToken(loginBody.access_token);

      // 3. Apply for brand membership
      const applyResp = await fetch(`${API_BASE_URL}/api/brands/apply`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loginBody.access_token}`,
        },
        body: JSON.stringify({
          name: params.brandName.trim(),
          contact_person: params.contactName.trim(),
          contact_email: cleanEmail,
          website: params.website?.trim() || undefined,
          instagram: params.instagram?.trim() || undefined,
          city: params.location?.trim() || undefined,
          country: "India",
        }),
      });

      const applyBody = await applyResp.json().catch(() => ({}));
      if (!applyResp.ok) {
        return { success: false, error: formatAuthError(applyBody.detail || applyBody.message || "Brand application failed.") };
      }

      // 4. Fetch updated role and brand mapping
      const updatedUser = await this.getCurrentUser();
      if (!updatedUser) {
        return {
          success: true,
          redirectTo: "/login",
        };
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("pressonfit_auth_change"));
      }

      return {
        success: true,
        user: updatedUser,
        redirectTo: getBrandPortalPath(updatedUser.brandId),
      };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  async sendPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.isRemoteEnabled()) {
      return this.demoAdapter.sendPasswordReset(email);
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        return { success: false, error: "Please enter your email address." };
      }

      const resp = await fetch(`${API_BASE_URL}/api/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return { success: false, error: formatAuthError(body.detail || body.message || "Password reset request failed.") };
      }

      return {
        success: true,
        message: body.message || "Password reset instructions have been sent to your email address.",
      };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  async updatePassword(newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.isRemoteEnabled()) {
      return this.demoAdapter.updatePassword(newPassword);
    }

    try {
      if (!newPassword || newPassword.length < 8) {
        return { success: false, error: "Password must be at least 8 characters long." };
      }

      // Check URL query parameters for reset token
      let token = "";
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        token = params.get("token") || params.get("reset_token") || "";
      }

      if (!token) {
        return {
          success: false,
          error: "Password reset token is missing from the link. Please request a new password reset link.",
        };
      }

      const resp = await fetch(`${API_BASE_URL}/api/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return { success: false, error: formatAuthError(body.detail || body.message || "Failed to reset password.") };
      }

      return {
        success: true,
        message: body.message || "Your password has been successfully updated.",
      };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }

  async verifyEmail(token: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.isRemoteEnabled()) {
      return { success: true, message: "Email verified in demo simulation." };
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return { success: false, error: formatAuthError(body.detail || body.message || "Email verification failed.") };
      }

      return {
        success: true,
        message: body.message || "Email verified successfully.",
      };
    } catch (err) {
      return { success: false, error: formatAuthError(err) };
    }
  }
}

/**
 * Singleton Auth Adapter
 */
export const authAdapter: AuthAdapter = new FastApiAuthAdapter();
