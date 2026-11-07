export interface FingerWidthMap {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

export type StandardSizeKey = "XS" | "S" | "M" | "L";

export type ChartFormat = "per_size_fingers" | "width_ranges";

export interface NailWidthRange {
  sizeLabel: string;
  minMm: number;
  maxMm: number;
}

export interface BrandSizingChart {
  id: string;
  brandId: string;
  chartName: string;
  unit: "mm";
  updatedDate: string;
  format?: ChartFormat;
  sizes: Record<string, FingerWidthMap>;
  ranges?: NailWidthRange[];
  customNotes?: string;
  sourceType: "manual" | "csv_upload" | "json_upload" | "preset";
}

export type BrandPlan = "starter" | "studio";

export type BrandAccountStatus =
  | "active"
  | "pending_review"
  | "rejected"
  | "suspended"
  | "demo_sample";

export type RenewalIntent = "yes" | "no" | "pending" | "not_asked";

export interface Brand {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  contactPerson?: string;
  contactEmail: string;
  website?: string;
  instagram?: string;
  location: string;
  status: BrandAccountStatus;
  isDemo: boolean;
  shapes: string[];
  sizingChart: BrandSizingChart;
  plan?: BrandPlan;
  profileVisibility?: "public" | "hidden";
  chartVisibility?: "public" | "hidden";
  trialStartDate?: string;
  trialEndDate?: string;
  renewalIntent?: RenewalIntent;
  adminNotes?: string;
  submittedDate?: string;
}

/**
 * Publicly visible brand profile type corresponding to public.brands_public view.
 * Excludes sensitive/internal columns: owner_id, admin_notes, contactPerson, contactEmail, status, trial details.
 */
export interface PublicBrandProfile {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  website: string | null;
  instagram: string | null;
  city: string | null;
  country: string;
  shapes: string[];
  created_at?: string;
  updated_at?: string;
  // Optional public sizing chart when joined or loaded for detail view
  sizingChart?: BrandSizingChart;
}

export interface BrandUser {
  id: string;
  brandId: string;
  email: string;
  name: string;
  role: "owner" | "manager";
  isDemoSession: boolean;
}
