/**
 * PressOn Fit - FastAPI Backend Configuration & Safe Token Transport
 *
 * Connects the frontend to the FastAPI business backend.
 * Database credentials and JWT signing secrets are strictly server-side and never exposed here.
 */

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.VITE_BRAND_API_URL?.replace("127.0.0.1", "localhost")) ||
  "http://localhost:8001"
).replace(/\/+$/, "");

/**
 * Access Token Storage Architecture:
 * - The primary token cache is in-memory (_inMemoryAccessToken).
 * - Ephemeral tab storage uses sessionStorage solely to survive soft page reloads within the same browser tab.
 * - localStorage is STRICTLY PROHIBITED for access tokens to prevent persistent disk storage, cross-tab leakage,
 *   and long-lived XSS exposure.
 * - Long-lived session persistence is handled exclusively by the server via the rotating HttpOnly refresh cookie.
 */
const ACCESS_TOKEN_KEY = "pressonfit_access_token";

let _inMemoryAccessToken: string | null = null;

export function getStoredAccessToken(): string | null {
  if (_inMemoryAccessToken) return _inMemoryAccessToken;
  if (typeof window === "undefined") return null;
  try {
    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    _inMemoryAccessToken = token;
    return token;
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string | null): void {
  _inMemoryAccessToken = token;
  if (typeof window === "undefined") return;
  try {
    if (token) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // Storage access fallback
  }
}

export function clearStoredAccessToken(): void {
  setStoredAccessToken(null);
}

export function isRemoteApiEnabled(): boolean {
  if (import.meta.env.VITE_ENABLE_DEMO_ONLY === "true") {
    return false;
  }
  if (import.meta.env.VITE_ENABLE_REMOTE_API === "false" || import.meta.env.VITE_ENABLE_API === "false") {
    return false;
  }
  return true;
}

export function getApiConfigStatus(): {
  configured: boolean;
  apiEnabled: boolean;
  baseUrl: string;
  statusMessage: string;
} {
  const enabled = isRemoteApiEnabled();
  return {
    configured: Boolean(API_BASE_URL),
    apiEnabled: enabled,
    baseUrl: API_BASE_URL,
    statusMessage: enabled
      ? `Connected to PressOn Fit API at ${API_BASE_URL}`
      : "Running in local demonstration mode.",
  };
}
