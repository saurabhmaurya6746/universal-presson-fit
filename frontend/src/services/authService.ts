import { getBrands, saveBrands } from "./brandService";
import type { Brand } from "@/types/brand";

export type UserRole = "personal" | "brand" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  brandId?: string;
  brandName?: string;
  trialStartDate?: string;
  trialEndDate?: string;
  isDemoSession: boolean;
}

export type BrandPortalSection = "dashboard" | "charts" | "settings";

export function getBrandPortalPath(brandId: string | undefined, section: BrandPortalSection = "dashboard"): string {
  return brandId ? `/brand/${encodeURIComponent(brandId)}/${section}` : "/brand";
}

const STORAGE_KEYS = {
  CURRENT_USER: "pressonfit_demo_session_v1",
  REGISTERED_USERS: "pressonfit_demo_registered_accounts_v1",
};

// Preset demo accounts (passwords are validated client-side for demo simulation only; no real security claimed)
const PRESET_DEMO_ACCOUNTS: Record<string, Omit<AuthUser, "id" | "isDemoSession">> = {
  "admin@pressonfit.com": {
    email: "admin@pressonfit.com",
    name: "Platform Administrator",
    role: "admin",
  },
  "pressons@auranails.com": {
    email: "pressons@auranails.com",
    name: "Aura Luxury Manager",
    role: "brand",
    brandId: "brand-aura-luxury",
    brandName: "Aura Luxury Press-Ons",
  },
  "orders@velvetclaws.example.com": {
    email: "orders@velvetclaws.example.com",
    name: "Velvet Claws Manager",
    role: "brand",
    brandId: "brand-velvet-claws",
    brandName: "Velvet Claws Studio",
  },
  "concierge@luxetip.example.com": {
    email: "concierge@luxetip.example.com",
    name: "LuxeTip Atelier Concierge",
    role: "brand",
    brandId: "brand-luxetip-atelier",
    brandName: "LuxeTip Atelier",
  },
  "brand@pressonfit.com": {
    email: "brand@pressonfit.com",
    name: "Sample Brand Partner",
    role: "brand",
    brandId: "brand-aura-luxury",
    brandName: "Aura Luxury Press-Ons",
  },
  "user@pressonfit.com": {
    email: "user@pressonfit.com",
    name: "Pooja Verma",
    role: "personal",
  },
  "customer@example.com": {
    email: "customer@example.com",
    name: "Ananya Sen",
    role: "personal",
  },
};

function getRegisteredUsers(): Record<string, Omit<AuthUser, "id" | "isDemoSession">> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRegisteredUser(email: string, user: Omit<AuthUser, "id" | "isDemoSession">): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRegisteredUsers();
    current[email.toLowerCase()] = user;
    localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(current));
  } catch (e) {
    console.error("Failed to save registered demo account:", e);
  }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function logout(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    window.dispatchEvent(new Event("pressonfit_auth_change"));
  } catch {
    // ignore
  }
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  redirectTo?: string;
}

export function loginUser(email: string, password?: string): LoginResult {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return { success: false, error: "Please enter your email address." };
  }

  if (!password || password.length < 1) {
    return { success: false, error: "Please enter your password." };
  }

  // Check preset accounts or local registered accounts
  const registered = getRegisteredUsers();
  const accountMeta = PRESET_DEMO_ACCOUNTS[cleanEmail] || registered[cleanEmail];

  if (!accountMeta) {
    return {
      success: false,
      error: "Account not found. Please check your email or create an account below.",
    };
  }

  const user: AuthUser = {
    id: `usr-${cleanEmail.replace(/[^a-zA-Z0-9]/g, "_")}`,
    ...accountMeta,
    isDemoSession: true,
  };

  // Determine redirect based on resolved role
  let redirectTo = "/account";
  if (user.role === "admin") {
    redirectTo = "/admin";
  } else if (user.role === "brand") {
    redirectTo = getBrandPortalPath(user.brandId);
  }

  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pressonfit_auth_change"));
    }
  } catch {
    return { success: false, error: "Could not save demo session to browser storage." };
  }

  return { success: true, user, redirectTo };
}

export interface RegisterPersonalParams {
  name: string;
  email: string;
}

export function registerPersonalAccount(params: RegisterPersonalParams): LoginResult {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = params.name.trim();

  if (!cleanName || !cleanEmail) {
    return { success: false, error: "Please enter your name and email." };
  }

  const userMeta: Omit<AuthUser, "id" | "isDemoSession"> = {
    email: cleanEmail,
    name: cleanName,
    role: "personal",
  };

  saveRegisteredUser(cleanEmail, userMeta);

  const user: AuthUser = {
    id: `usr-${Date.now()}`,
    ...userMeta,
    isDemoSession: true,
  };

  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pressonfit_auth_change"));
    }
  } catch {
    // ignore
  }

  return { success: true, user, redirectTo: "/account" };
}

export interface RegisterBrandParams {
  brandName: string;
  contactName: string;
  businessEmail: string;
  website?: string;
  instagram?: string;
  location: string;
}

export function registerBrandAccount(params: RegisterBrandParams): LoginResult {
  const cleanEmail = params.businessEmail.trim().toLowerCase();
  const cleanBrandName = params.brandName.trim();
  const cleanContactName = params.contactName.trim();

  if (!cleanBrandName || !cleanEmail || !cleanContactName) {
    return { success: false, error: "Please fill in all required brand fields." };
  }

  if (!params.website?.trim() && !params.instagram?.trim()) {
    return { success: false, error: "Please provide either a website URL or Instagram handle for brand verification." };
  }

  const brandSlug = cleanBrandName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const brandId = `brand-${brandSlug}-${Date.now().toString().slice(-4)}`;

  // Calculate 10-day free trial dates
  const now = new Date();
  const trialStart = now.toISOString();
  const trialEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();

  // Create brand entry in Brand Registry
  const brands = getBrands();
  const newBrand: Brand = {
    id: brandId,
    name: cleanBrandName,
    slug: brandSlug,
    tagline: "Handcrafted press-on collection",
    description: `Independent press-on atelier managed by ${cleanContactName}. Calibrated for custom nail sizing.`,
    contactEmail: cleanEmail,
    website: params.website?.trim(),
    instagram: params.instagram?.trim(),
    location: params.location.trim() || "India",
    status: "pending_review",
    isDemo: true,
    shapes: ["Almond", "Coffin", "Square", "Oval"],
    sizingChart: {
      id: `chart-${brandSlug}`,
      brandId: brandId,
      chartName: `${cleanBrandName} Sizing Chart`,
      unit: "mm",
      updatedDate: now.toISOString().split("T")[0],
      sourceType: "manual",
      customNotes: "Initial trial chart setup. Calibrated for standard press-on sizing.",
      sizes: {
        XS: { thumb: 14, index: 11, middle: 12, ring: 10, pinky: 8 },
        S: { thumb: 15, index: 12, middle: 13, ring: 11, pinky: 8 },
        M: { thumb: 16, index: 12, middle: 14, ring: 11, pinky: 9 },
        L: { thumb: 18, index: 13, middle: 15, ring: 12, pinky: 10 },
      },
    },
  };

  brands.unshift(newBrand);
  saveBrands(brands);

  const userMeta: Omit<AuthUser, "id" | "isDemoSession"> = {
    email: cleanEmail,
    name: cleanContactName,
    role: "brand",
    brandId,
    brandName: cleanBrandName,
    trialStartDate: trialStart,
    trialEndDate: trialEnd,
  };

  saveRegisteredUser(cleanEmail, userMeta);

  const user: AuthUser = {
    id: `usr-${Date.now()}`,
    ...userMeta,
    isDemoSession: true,
  };

  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pressonfit_auth_change"));
    }
  } catch {
    // ignore
  }

  return { success: true, user, redirectTo: getBrandPortalPath(brandId) };
}

export interface TrialStatus {
  daysLeft: number;
  isExpired: boolean;
  progressPercent: number;
  trialEndDateFormatted: string;
}

export function getTrialStatus(_startDateStr?: string, endDateStr?: string): TrialStatus {
  const now = Date.now();
  // Default to 10 days if not set
  let endMs: number;
  if (endDateStr) {
    endMs = new Date(endDateStr).getTime();
  } else {
    endMs = now + 10 * 24 * 60 * 60 * 1000;
  }

  const diffMs = endMs - now;
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isExpired = diffMs <= 0;
  const daysPassed = Math.min(10, Math.max(0, 10 - daysLeft));
  const progressPercent = Math.round((daysPassed / 10) * 100);

  const dateObj = new Date(endMs);
  const trialEndDateFormatted = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    daysLeft,
    isExpired,
    progressPercent,
    trialEndDateFormatted,
  };
}
