import { API_BASE_URL, isRemoteApiEnabled } from "@/lib/apiConfig";
import { getBrands, getBrandById } from "./brandService";
import type { PublicBrandProfile, BrandSizingChart, ChartFormat } from "@/types/brand";

/**
 * Public Brand Repository Interface
 *
 * Provides separation between public catalog consumers (directory & detail pages)
 * and data storage.
 *
 * Mode:
 * - When remote API is active, queries FastAPI public catalog routes (`/api/public/brands`).
 * - If remote fetching fails, does NOT silently fall back to demo data.
 * - In demo mode, loads from `brandService` (local demo data).
 */
export interface PublicBrandRepository {
  isRemoteEnabled(): boolean;
  getPublicBrands(): Promise<PublicBrandProfile[]>;
  getPublicBrandBySlugOrId(idOrSlug: string): Promise<PublicBrandProfile | null>;
}

/**
 * Demo Implementation
 * Wraps local demo storage without making network requests.
 */
class DemoPublicBrandRepository implements PublicBrandRepository {
  isRemoteEnabled(): boolean {
    return false;
  }

  async getPublicBrands(): Promise<PublicBrandProfile[]> {
    const brands = getBrands();
    return brands
      .filter((b) => b.profileVisibility !== "hidden" && b.status === "active")
      .map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        tagline: b.tagline,
        description: b.description,
        website: b.website || null,
        instagram: b.instagram || null,
        city: b.location?.split(",")[0]?.trim() || null,
        country: b.location?.split(",")[1]?.trim() || "India",
        shapes: b.shapes,
        sizingChart: b.sizingChart,
      }));
  }

  async getPublicBrandBySlugOrId(idOrSlug: string): Promise<PublicBrandProfile | null> {
    const brand = getBrandById(idOrSlug);
    if (!brand || brand.profileVisibility === "hidden" || brand.status !== "active") {
      return null;
    }

    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      tagline: brand.tagline,
      description: brand.description,
      website: brand.website || null,
      instagram: brand.instagram || null,
      city: brand.location?.split(",")[0]?.trim() || null,
      country: brand.location?.split(",")[1]?.trim() || "India",
      shapes: brand.shapes,
      sizingChart: brand.sizingChart,
    };
  }
}

/**
 * FastAPI Implementation
 * Queries public endpoints with allowlisted customer-safe fields.
 */
class FastApiPublicBrandRepository implements PublicBrandRepository {
  private demoRepo = new DemoPublicBrandRepository();

  isRemoteEnabled(): boolean {
    return isRemoteApiEnabled();
  }

  async getPublicBrands(): Promise<PublicBrandProfile[]> {
    if (!this.isRemoteEnabled()) {
      return this.demoRepo.getPublicBrands();
    }

    const resp = await fetch(`${API_BASE_URL}/api/public/brands`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!resp.ok) {
      throw new Error(`Failed to fetch public brands: HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const rows = Array.isArray(data) ? data : [];

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      tagline: row.tagline || null,
      description: row.description || null,
      website: row.website || null,
      instagram: row.instagram || null,
      city: row.city || null,
      country: row.country || "India",
      shapes: row.shapes || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
      sizingChart: row.sizingChart || row.sizing_chart,
    }));
  }

  async getPublicBrandBySlugOrId(idOrSlug: string): Promise<PublicBrandProfile | null> {
    if (!this.isRemoteEnabled()) {
      return this.demoRepo.getPublicBrandBySlugOrId(idOrSlug);
    }

    const resp = await fetch(`${API_BASE_URL}/api/public/brands/${encodeURIComponent(idOrSlug)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (resp.status === 404) {
      return null;
    }

    if (!resp.ok) {
      throw new Error(`Failed to load brand: HTTP ${resp.status}`);
    }

    const data = await resp.json();
    if (!data || !data.id) return null;

    let sizingChart: BrandSizingChart | undefined = undefined;
    const rawChart = data.sizingChart || data.sizing_chart;

    if (rawChart) {
      sizingChart = {
        id: rawChart.id,
        brandId: rawChart.brand_id || rawChart.brandId,
        chartName: rawChart.chart_name || rawChart.chartName,
        unit: rawChart.unit || "mm",
        updatedDate: rawChart.updatedDate || rawChart.updated_at?.split("T")[0] || "",
        format: (rawChart.format === "width_ranges" ? "width_ranges" : "per_size_fingers") as ChartFormat,
        sizes: rawChart.sizes || {},
        ranges: rawChart.ranges || [],
        customNotes: rawChart.custom_notes || rawChart.customNotes || undefined,
        sourceType: (rawChart.source_type || rawChart.sourceType || "manual") as "manual" | "csv_upload" | "json_upload" | "preset",
      };
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      tagline: data.tagline || null,
      description: data.description || null,
      website: data.website || null,
      instagram: data.instagram || null,
      city: data.city || null,
      country: data.country || "India",
      shapes: data.shapes || [],
      created_at: data.created_at,
      updated_at: data.updated_at,
      sizingChart,
    };
  }
}

/**
 * Singleton Public Brand Repository
 */
export const publicBrandRepository: PublicBrandRepository = new FastApiPublicBrandRepository();
