export interface FingerWidthMap {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

export type StandardSizeKey = "XS" | "S" | "M" | "L";

export type ChartFormat =
  | "per_size_fingers"
  | "width_ranges"
  | "preset_set"
  | "numbered_size"
  | "shape_range"
  | "length_only_numbered"
  | "per_size";

export interface NailWidthRange {
  sizeLabel: string;
  minMm: number;
  maxMm: number;
}

export interface NumberedSizeEntry {
  size: string;
  width_mm?: number | null;
  min_width_mm?: number | null;
  max_width_mm?: number | null;
  is_approximate?: boolean;
  typical_finger?: string | null;
}

export interface ShapeRangeEntry {
  shape: string;
  length_min_mm?: number | null;
  length_max_mm?: number | null;
  width_min_mm?: number | null;
  width_max_mm?: number | null;
  thickness_mm?: number | null;
}

export interface SizingChartEntryRaw {
  id?: string;
  chart_id?: string;
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

export interface BrandSizingChart {
  id: string;
  brandId: string;
  chartName: string;
  unit: "mm";
  updatedDate: string;
  format?: ChartFormat;
  sizes: Record<string, FingerWidthMap>;
  ranges?: NailWidthRange[];
  numbered_sizes?: NumberedSizeEntry[];
  shape_ranges?: ShapeRangeEntry[];
  length_numbered_sizes?: Record<string, Record<string, number>>;
  sizing_chart_entries?: SizingChartEntryRaw[];
  customNotes?: string;
  source_url?: string | null;
  source_notes?: string | null;
  verification_status?: string;
  is_official?: boolean;
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
  logo_url?: string | null;
  is_official?: boolean;
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
  logo_url?: string | null;
  is_official?: boolean;
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
