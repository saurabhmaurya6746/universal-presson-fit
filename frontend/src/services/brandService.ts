import type {
  Brand,
  BrandSizingChart,
  BrandUser,
  BrandAccountStatus,
  RenewalIntent,
  BrandPlan,
} from "@/types/brand";

/**
 * Notice regarding Backend Support:
 * There is currently no active brand REST API / database backend in this project.
 * All brand profiles, authentication sessions, and chart modifications are simulated
 * via in-memory and browser localStorage caching for UI evaluation.
 */
export const IS_BACKEND_MOCK = true;

const STORAGE_KEYS = {
  BRANDS: "pressonfit_brand_registry_demo_v2",
  CURRENT_USER: "aura_brand_session_demo_v1",
};

// Realistic relative timestamps for demo evaluation
const nowMs = Date.now();
const msPerDay = 86400000;

const DEFAULT_DEMO_BRANDS: Brand[] = [
  {
    id: "brand-aura-luxury",
    name: "Aura Luxury Press-Ons",
    slug: "aura-luxury",
    tagline: "Handcrafted salon-quality reusable sets",
    description:
      "Signature bespoke press-on sets designed for luxury durability and flawless natural nail alignment. Hand-painted with salon gel overlay.",
    contactPerson: "Khushi Sharma",
    contactEmail: "pressons@auranails.com",
    website: "https://auranails.example.com",
    instagram: "@auranails_by_khushi",
    location: "New Delhi, India",
    status: "active",
    isDemo: true,
    plan: "studio",
    profileVisibility: "public",
    chartVisibility: "public",
    shapes: ["Almond", "Coffin", "Square", "Stiletto", "Oval"],
    trialStartDate: new Date(nowMs - 8 * msPerDay).toISOString(),
    trialEndDate: new Date(nowMs + 2 * msPerDay).toISOString(), // 2 days left (Ending Soon)
    renewalIntent: "yes",
    submittedDate: "2026-10-15",
    adminNotes: "Signature studio partner. Chart calibrated with 10-coin optical standards.",
    sizingChart: {
      id: "chart-aura-01",
      brandId: "brand-aura-luxury",
      chartName: "Aura Standard Press-On Chart 2026",
      unit: "mm",
      format: "per_size_fingers",
      updatedDate: "2026-10-15",
      sourceType: "preset",
      customNotes: "Calibrated for 10-coin reference measurements. Ideal for medium c-curve natural nails.",
      sizes: {
        XS: { thumb: 14, index: 11, middle: 12, ring: 10, pinky: 8 },
        S: { thumb: 15, index: 12, middle: 13, ring: 11, pinky: 8 },
        M: { thumb: 16, index: 12, middle: 14, ring: 11, pinky: 9 },
        L: { thumb: 18, index: 13, middle: 15, ring: 12, pinky: 10 },
      },
    },
  },
  {
    id: "brand-velvet-claws",
    name: "Velvet Claws Studio",
    slug: "velvet-claws",
    tagline: "Artisan sculpted press-on nails for every occasion",
    description:
      "Specializes in anime, 3D chrome, and gothic statement sets. Crafted on soft-gel extensions for long-lasting wear up to 3 weeks.",
    contactPerson: "Aarav Roy",
    contactEmail: "orders@velvetclaws.example.com",
    website: "https://velvetclaws.example.com",
    instagram: "@velvetclaws_official",
    location: "Mumbai, India",
    status: "active",
    isDemo: true,
    plan: "starter",
    profileVisibility: "public",
    chartVisibility: "public",
    shapes: ["Almond", "Stiletto", "Ballerina", "Duck Nails"],
    trialStartDate: new Date(nowMs - 15 * msPerDay).toISOString(),
    trialEndDate: new Date(nowMs - 5 * msPerDay).toISOString(), // Expired
    renewalIntent: "pending",
    submittedDate: "2026-10-01",
    adminNotes: "Sent renewal inquiry note on day 9. Partner requested custom sizing tier review.",
    sizingChart: {
      id: "chart-vc-01",
      brandId: "brand-velvet-claws",
      chartName: "Velvet Claws Millimeter Range Chart",
      unit: "mm",
      format: "width_ranges",
      updatedDate: "2026-09-28",
      sourceType: "preset",
      customNotes: "Manufacturer nail-width range system mapped to tip size numbers.",
      sizes: {
        XS: { thumb: 15, index: 11, middle: 12, ring: 10, pinky: 8 },
        S: { thumb: 16, index: 12, middle: 13, ring: 11, pinky: 9 },
        M: { thumb: 17, index: 13, middle: 14, ring: 12, pinky: 10 },
        L: { thumb: 19, index: 14, middle: 16, ring: 13, pinky: 11 },
      },
      ranges: [
        { sizeLabel: "0", minMm: 17.5, maxMm: 19.5 },
        { sizeLabel: "1", minMm: 16.0, maxMm: 17.4 },
        { sizeLabel: "2", minMm: 15.0, maxMm: 15.9 },
        { sizeLabel: "3", minMm: 14.0, maxMm: 14.9 },
        { sizeLabel: "4", minMm: 13.0, maxMm: 13.9 },
        { sizeLabel: "5", minMm: 12.0, maxMm: 12.9 },
        { sizeLabel: "6", minMm: 11.0, maxMm: 11.9 },
        { sizeLabel: "7", minMm: 10.0, maxMm: 10.9 },
        { sizeLabel: "8", minMm: 9.0, maxMm: 9.9 },
        { sizeLabel: "9", minMm: 8.0, maxMm: 8.9 },
      ],
    },
  },
  {
    id: "brand-luxetip-atelier",
    name: "LuxeTip Atelier",
    slug: "luxetip-atelier",
    tagline: "Minimalist everyday gel press-ons",
    description:
      "Everyday neutrals, glazed donut nails, and micro-french designs tailored for professional and chic daily styling.",
    contactPerson: "Ria Sen",
    contactEmail: "concierge@luxetip.example.com",
    website: "https://luxetip.example.com",
    instagram: "@luxetip_atelier",
    location: "Bengaluru, India",
    status: "active",
    isDemo: true,
    plan: "starter",
    profileVisibility: "public",
    chartVisibility: "public",
    shapes: ["Short Round", "Squoval", "Short Almond"],
    trialStartDate: new Date(nowMs - 3 * msPerDay).toISOString(),
    trialEndDate: new Date(nowMs + 7 * msPerDay).toISOString(), // 7 days left (Active)
    renewalIntent: "not_asked",
    submittedDate: "2026-10-20",
    adminNotes: "Petite fit chart. Ready for catalogue promotion.",
    sizingChart: {
      id: "chart-lt-01",
      brandId: "brand-luxetip-atelier",
      chartName: "LuxeTip Petite Fit Index",
      unit: "mm",
      format: "per_size_fingers",
      updatedDate: "2026-10-02",
      sourceType: "preset",
      customNotes: "Optimized for flatter nail beds and shorter lengths.",
      sizes: {
        XS: { thumb: 13, index: 10, middle: 11, ring: 9, pinky: 7 },
        S: { thumb: 14, index: 11, middle: 12, ring: 10, pinky: 8 },
        M: { thumb: 15, index: 12, middle: 13, ring: 11, pinky: 9 },
        L: { thumb: 17, index: 13, middle: 14, ring: 12, pinky: 10 },
      },
    },
  },
  {
    id: "brand-celestial-tips",
    name: "Celestial Tips Studio",
    slug: "celestial-tips",
    tagline: "Hand-painted cosmic and aura press-on sets",
    description:
      "Bespoke astrology and ethereal designs crafted on gel-x tips. Ready for size validation.",
    contactPerson: "Neha Gupta",
    contactEmail: "neha@celestialtips.example",
    website: "https://celestialtips.example",
    instagram: "@celestial_tips",
    location: "Jaipur, India",
    status: "pending_review",
    isDemo: true,
    plan: "studio",
    profileVisibility: "hidden",
    chartVisibility: "hidden",
    shapes: ["Medium Almond", "Long Coffin"],
    trialStartDate: new Date(nowMs - 1 * msPerDay).toISOString(),
    trialEndDate: new Date(nowMs + 9 * msPerDay).toISOString(),
    renewalIntent: "not_asked",
    submittedDate: "2026-10-31",
    adminNotes: "New studio application. Sizing chart uploaded; pending admin verification.",
    sizingChart: {
      id: "chart-ct-01",
      brandId: "brand-celestial-tips",
      chartName: "Celestial Standard Set Chart",
      unit: "mm",
      format: "per_size_fingers",
      updatedDate: "2026-10-31",
      sourceType: "manual",
      customNotes: "Needs review for thumb sizing accuracy.",
      sizes: {
        XS: { thumb: 14, index: 11, middle: 12, ring: 10, pinky: 8 },
        S: { thumb: 15, index: 12, middle: 13, ring: 11, pinky: 8 },
        M: { thumb: 16, index: 12, middle: 14, ring: 11, pinky: 9 },
        L: { thumb: 18, index: 13, middle: 15, ring: 12, pinky: 10 },
      },
    },
  },
  {
    id: "brand-starlight-atelier",
    name: "Starlight Atelier",
    slug: "starlight-atelier",
    tagline: "Hand-sculpted bridal press-on nails",
    description:
      "Pearl, lace, and bridal embellishments on short and medium lengths.",
    contactPerson: "Simran Kaur",
    contactEmail: "simran@starlightatelier.example",
    website: "https://starlightatelier.example",
    instagram: "@starlight_atelier",
    location: "Chandigarh, India",
    status: "suspended",
    isDemo: true,
    plan: "starter",
    profileVisibility: "hidden",
    chartVisibility: "hidden",
    shapes: ["Short Oval", "Squoval"],
    trialStartDate: new Date(nowMs - 25 * msPerDay).toISOString(),
    trialEndDate: new Date(nowMs - 15 * msPerDay).toISOString(),
    renewalIntent: "no",
    submittedDate: "2026-09-15",
    adminNotes: "Studio requested temporary suspension during studio renovation.",
    sizingChart: {
      id: "chart-sl-01",
      brandId: "brand-starlight-atelier",
      chartName: "Starlight Bridal Curve Standard",
      unit: "mm",
      format: "per_size_fingers",
      updatedDate: "2026-09-15",
      sourceType: "preset",
      sizes: {
        XS: { thumb: 14, index: 11, middle: 12, ring: 10, pinky: 8 },
        S: { thumb: 15, index: 12, middle: 13, ring: 11, pinky: 8 },
        M: { thumb: 16, index: 12, middle: 14, ring: 11, pinky: 9 },
        L: { thumb: 18, index: 13, middle: 15, ring: 12, pinky: 10 },
      },
    },
  },
];

export function getBrands(): Brand[] {
  if (typeof window === "undefined") return DEFAULT_DEMO_BRANDS;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BRANDS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(DEFAULT_DEMO_BRANDS));
      return DEFAULT_DEMO_BRANDS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure missing demo fields are populated safely
      return parsed.map((b) => ({
        ...b,
        status: b.status || "active",
        plan: b.plan || (b.slug === "aura-luxury" || b.slug === "celestial-tips" ? "studio" : "starter"),
        profileVisibility: b.profileVisibility || (b.status === "suspended" ? "hidden" : "public"),
        chartVisibility: b.chartVisibility || (b.status === "suspended" ? "hidden" : "public"),
        contactPerson: b.contactPerson || b.name + " Manager",
        renewalIntent: b.renewalIntent || "not_asked",
        trialStartDate: b.trialStartDate || new Date(Date.now() - 3 * 86400000).toISOString(),
        trialEndDate: b.trialEndDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        sizingChart: {
          ...b.sizingChart,
          format: b.sizingChart?.format || (b.sizingChart?.ranges && b.sizingChart.ranges.length > 0 ? "width_ranges" : "per_size_fingers"),
          ranges: b.sizingChart?.ranges || (b.slug === "velvet-claws" ? [
            { sizeLabel: "0", minMm: 17.5, maxMm: 19.5 },
            { sizeLabel: "1", minMm: 16.0, maxMm: 17.4 },
            { sizeLabel: "2", minMm: 15.0, maxMm: 15.9 },
            { sizeLabel: "3", minMm: 14.0, maxMm: 14.9 },
            { sizeLabel: "4", minMm: 13.0, maxMm: 13.9 },
            { sizeLabel: "5", minMm: 12.0, maxMm: 12.9 },
            { sizeLabel: "6", minMm: 11.0, maxMm: 11.9 },
            { sizeLabel: "7", minMm: 10.0, maxMm: 10.9 },
            { sizeLabel: "8", minMm: 9.0, maxMm: 9.9 },
            { sizeLabel: "9", minMm: 8.0, maxMm: 8.9 },
          ] : []),
        },
      }));
    }
  } catch {
    // fallback
  }
  return DEFAULT_DEMO_BRANDS;
}

export function getBrandById(idOrSlug: string): Brand | undefined {
  const brands = getBrands();
  return brands.find((b) => b.id === idOrSlug || b.slug === idOrSlug);
}

export function saveBrands(brands: Brand[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(brands));
  } catch (err) {
    console.error("Failed to save brands to localStorage:", err);
  }
}

export function getCurrentBrandUser(): BrandUser | null {
  if (typeof window === "undefined") return null;
  try {
    // Check unified auth session first
    const unifiedRaw = localStorage.getItem("pressonfit_demo_session_v1");
    if (unifiedRaw) {
      const u = JSON.parse(unifiedRaw);
      if (u && u.role === "brand" && u.brandId) {
        return {
          id: u.id || `usr-${u.brandId}`,
          brandId: u.brandId,
          email: u.email,
          name: u.name,
          role: "owner",
          isDemoSession: true,
        };
      }
    }

    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loginBrandDemo(email: string): { success: boolean; user?: BrandUser; error?: string } {
  const brands = getBrands();
  // Find brand by email or default to first demo brand
  const matchedBrand = brands.find((b) => b.contactEmail.toLowerCase() === email.trim().toLowerCase()) || brands[0];

  const demoUser: BrandUser = {
    id: `usr-${matchedBrand.id}`,
    brandId: matchedBrand.id,
    email: email.trim() || matchedBrand.contactEmail,
    name: matchedBrand.name + " Manager",
    role: "owner",
    isDemoSession: true,
  };

  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(demoUser));
    // Also sync to unified demo session
    localStorage.setItem(
      "pressonfit_demo_session_v1",
      JSON.stringify({
        ...demoUser,
        role: "brand",
        brandName: matchedBrand.name,
      })
    );
    return { success: true, user: demoUser };
  } catch (err) {
    return { success: false, error: "Failed to initialize demo session in browser storage." };
  }
}

export function logoutBrand(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem("pressonfit_demo_session_v1");
  } catch {
    // ignore
  }
}

export function updateBrandChart(brandId: string, chart: BrandSizingChart): boolean {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return false;

  brands[idx].sizingChart = {
    ...chart,
    updatedDate: new Date().toISOString().split("T")[0],
  };

  saveBrands(brands);
  return true;
}

/**
 * Admin workspace mutation helpers (persisted in local demo storage)
 */
export function updateBrandStatus(
  brandId: string,
  status: BrandAccountStatus,
  adminNotes?: string
): boolean {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return false;

  brands[idx].status = status;
  if (adminNotes !== undefined) {
    brands[idx].adminNotes = adminNotes;
  }

  saveBrands(brands);
  return true;
}

export function extendBrandTrial(
  brandId: string,
  additionalDays = 7
): { success: boolean; newEndDate?: string; daysLeft?: number } {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return { success: false };

  const currentEnd = brands[idx].trialEndDate
    ? new Date(brands[idx].trialEndDate!).getTime()
    : Date.now();
  const baseTime = Math.max(Date.now(), currentEnd);
  const newEnd = new Date(baseTime + additionalDays * 86400000).toISOString();

  brands[idx].trialEndDate = newEnd;
  // If brand was suspended or expired, make sure status is active
  if (brands[idx].status === "suspended") {
    brands[idx].status = "active";
  }

  const note = `[Trial Extended on ${new Date().toLocaleDateString()}] Added +${additionalDays} days to demo trial.`;
  brands[idx].adminNotes = brands[idx].adminNotes
    ? `${brands[idx].adminNotes}\n${note}`
    : note;

  saveBrands(brands);

  const diffMs = new Date(newEnd).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(diffMs / 86400000));

  return { success: true, newEndDate: newEnd, daysLeft };
}

export function updateBrandRenewalIntent(
  brandId: string,
  renewalIntent: RenewalIntent
): boolean {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return false;

  brands[idx].renewalIntent = renewalIntent;
  saveBrands(brands);
  return true;
}

export function recordRenewalInquiry(brandId: string): boolean {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return false;

  brands[idx].renewalIntent = "pending";
  const note = `[Renewal Inquired on ${new Date().toLocaleDateString()}] Demo renewal follow-up recorded in local state.`;
  brands[idx].adminNotes = brands[idx].adminNotes
    ? `${brands[idx].adminNotes}\n${note}`
    : note;

  saveBrands(brands);
  return true;
}

export function updateAdminNotes(brandId: string, notes: string): boolean {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return false;

  brands[idx].adminNotes = notes;
  saveBrands(brands);
  return true;
}

export function updateBrandProfile(brandId: string, updates: Partial<Brand>): boolean {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return false;

  brands[idx] = {
    ...brands[idx],
    ...updates,
  };

  saveBrands(brands);
  return true;
}

export function updateBrandDates(
  brandId: string,
  startDate?: string,
  endDate?: string
): boolean {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return false;

  if (startDate) brands[idx].trialStartDate = startDate;
  if (endDate) brands[idx].trialEndDate = endDate;

  saveBrands(brands);
  return true;
}

export function renewBrandTrial(
  brandId: string,
  fromDate: "previous_end" | "today",
  days = 10
): { success: boolean; newStartDate?: string; newEndDate?: string; daysLeft?: number } {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return { success: false };

  const prevEndMs = brands[idx].trialEndDate ? new Date(brands[idx].trialEndDate!).getTime() : Date.now();
  const baseStartMs = fromDate === "previous_end" ? prevEndMs : Date.now();
  const newStart = new Date(baseStartMs).toISOString();
  const newEnd = new Date(baseStartMs + days * 86400000).toISOString();

  brands[idx].trialStartDate = newStart;
  brands[idx].trialEndDate = newEnd;
  brands[idx].renewalIntent = "yes";
  if (brands[idx].status === "suspended" || brands[idx].status === "rejected") {
    brands[idx].status = "active";
  }

  const note = `[Trial Renewed on ${new Date().toLocaleDateString()}] Renewed for ${days} days starting from ${
    fromDate === "previous_end" ? "previous expiration date" : "current date"
  }.`;
  brands[idx].adminNotes = brands[idx].adminNotes
    ? `${brands[idx].adminNotes}\n${note}`
    : note;

  saveBrands(brands);

  const diffMs = new Date(newEnd).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(diffMs / 86400000));

  return { success: true, newStartDate: newStart, newEndDate: newEnd, daysLeft };
}

export function updateBrandPlan(brandId: string, plan: BrandPlan): boolean {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return false;

  brands[idx].plan = plan;
  saveBrands(brands);
  return true;
}

export function updateBrandVisibility(
  brandId: string,
  profileVisibility?: "public" | "hidden",
  chartVisibility?: "public" | "hidden"
): boolean {
  const brands = getBrands();
  const idx = brands.findIndex((b) => b.id === brandId);
  if (idx === -1) return false;

  if (profileVisibility) brands[idx].profileVisibility = profileVisibility;
  if (chartVisibility) brands[idx].chartVisibility = chartVisibility;

  saveBrands(brands);
  return true;
}

export function resetDemoBrands(): Brand[] {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEYS.BRANDS);
  }
  return getBrands();
}

/**
 * CSV parser helper for Brand Chart uploads.
 * Expected CSV columns:
 * Size,Thumb,Index,Middle,Ring,Pinky
 * e.g.:
 * XS,14,11,12,10,8
 * S,15,12,13,11,8
 */
export function parseChartFromCsv(csvText: string): {
  success: boolean;
  sizes?: Record<string, { thumb: number; index: number; middle: number; ring: number; pinky: number }>;
  error?: string;
} {
  try {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return { success: false, error: "CSV file is empty or has no data rows." };
    }

    const header = lines[0].toLowerCase().split(",").map((c) => c.trim());
    const sizeIdx = header.indexOf("size");
    const thumbIdx = header.findIndex((h) => h.includes("thumb"));
    const indexIdx = header.findIndex((h) => h.includes("index"));
    const midIdx = header.findIndex((h) => h.includes("mid"));
    const ringIdx = header.findIndex((h) => h.includes("ring"));
    const pinkyIdx = header.findIndex((h) => h.includes("pinky") || h.includes("little"));

    if (sizeIdx === -1 || thumbIdx === -1 || indexIdx === -1 || midIdx === -1 || ringIdx === -1 || pinkyIdx === -1) {
      return {
        success: false,
        error: "CSV columns must include: Size, Thumb, Index, Middle, Ring, Pinky",
      };
    }

    const sizes: Record<string, { thumb: number; index: number; middle: number; ring: number; pinky: number }> = {};

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      if (parts.length < header.length) continue;

      const sizeKey = parts[sizeIdx].toUpperCase();
      const thumb = parseFloat(parts[thumbIdx]);
      const index = parseFloat(parts[indexIdx]);
      const middle = parseFloat(parts[midIdx]);
      const ring = parseFloat(parts[ringIdx]);
      const pinky = parseFloat(parts[pinkyIdx]);

      if (!isNaN(thumb) && !isNaN(index) && !isNaN(middle) && !isNaN(ring) && !isNaN(pinky)) {
        sizes[sizeKey] = { thumb, index, middle, ring, pinky };
      }
    }

    if (Object.keys(sizes).length === 0) {
      return { success: false, error: "No valid numeric size rows could be parsed." };
    }

    return { success: true, sizes };
  } catch (err) {
    return { success: false, error: "Failed to parse CSV: " + (err instanceof Error ? err.message : String(err)) };
  }
}
