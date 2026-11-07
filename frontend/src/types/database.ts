/**
 * Database Types for PressOn Fit
 * Domain Schema Definition for PostgreSQL & Business API
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserPlatformRole = "personal" | "brand" | "admin";
export type BrandAccountStatus = "active" | "pending_review" | "rejected" | "suspended" | "demo_sample";
export type BrandMemberRole = "owner" | "manager";
export type ChartFormatType = "per_size" | "width_ranges";
export type ChartStatusType = "draft" | "published";
export type ChartSourceType = "manual" | "csv_upload" | "json_upload" | "preset";
export type HandSideOption = "left" | "right" | "both";
export type TrialStatusType = "active" | "ending_soon" | "expired" | "extended" | "converted";
export type RenewalIntentType = "yes" | "no" | "pending" | "not_asked";
export type BrandPlanTier = "starter" | "studio";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; // references auth.users(id)
          full_name: string;
          role: UserPlatformRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          role?: UserPlatformRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: UserPlatformRole;
          created_at?: string;
          updated_at?: string;
        };
      };
      brands: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          tagline: string | null;
          description: string | null;
          contact_person: string | null;
          contact_email: string;
          website: string | null;
          instagram: string | null;
          city: string | null;
          country: string;
          status: BrandAccountStatus;
          is_public: boolean;
          shapes: string[];
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
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
          country?: string;
          status?: BrandAccountStatus;
          is_public?: boolean;
          shapes?: string[];
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          tagline?: string | null;
          description?: string | null;
          contact_person?: string | null;
          contact_email?: string;
          website?: string | null;
          instagram?: string | null;
          city?: string | null;
          country?: string;
          status?: BrandAccountStatus;
          is_public?: boolean;
          shapes?: string[];
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      brand_members: {
        Row: {
          id: string;
          brand_id: string;
          profile_id: string;
          role: BrandMemberRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          profile_id: string;
          role?: BrandMemberRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          profile_id?: string;
          role?: BrandMemberRole;
          created_at?: string;
        };
      };
      sizing_charts: {
        Row: {
          id: string;
          brand_id: string;
          chart_name: string;
          format: ChartFormatType;
          unit: "mm";
          status: ChartStatusType;
          is_public: boolean;
          custom_notes: string | null;
          source_type: ChartSourceType;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          chart_name: string;
          format?: ChartFormatType;
          unit?: "mm";
          status?: ChartStatusType;
          is_public?: boolean;
          custom_notes?: string | null;
          source_type?: ChartSourceType;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          chart_name?: string;
          format?: ChartFormatType;
          unit?: "mm";
          status?: ChartStatusType;
          is_public?: boolean;
          custom_notes?: string | null;
          source_type?: ChartSourceType;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      sizing_chart_entries: {
        Row: {
          id: string;
          chart_id: string;
          size_label: string;
          thumb_width_mm: number | null;
          index_width_mm: number | null;
          middle_width_mm: number | null;
          ring_width_mm: number | null;
          pinky_width_mm: number | null;
          min_width_mm: number | null;
          max_width_mm: number | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          chart_id: string;
          size_label: string;
          thumb_width_mm?: number | null;
          index_width_mm?: number | null;
          middle_width_mm?: number | null;
          ring_width_mm?: number | null;
          pinky_width_mm?: number | null;
          min_width_mm?: number | null;
          max_width_mm?: number | null;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          chart_id?: string;
          size_label?: string;
          thumb_width_mm?: number | null;
          index_width_mm?: number | null;
          middle_width_mm?: number | null;
          ring_width_mm?: number | null;
          pinky_width_mm?: number | null;
          min_width_mm?: number | null;
          max_width_mm?: number | null;
          display_order?: number;
          created_at?: string;
        };
      };
      measurement_profiles: {
        Row: {
          id: string;
          user_id: string;
          nickname: string;
          hand_side: HandSideOption;
          measurements: Json;
          calibration_metadata: Json | null;
          validation_metadata: Json | null;
          summary_profile: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nickname?: string;
          hand_side?: HandSideOption;
          measurements: Json;
          calibration_metadata?: Json | null;
          validation_metadata?: Json | null;
          summary_profile?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          nickname?: string;
          hand_side?: HandSideOption;
          measurements?: Json;
          calibration_metadata?: Json | null;
          validation_metadata?: Json | null;
          summary_profile?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      brand_trials: {
        Row: {
          id: string;
          brand_id: string;
          start_date: string;
          end_date: string;
          status: TrialStatusType;
          renewal_intent: RenewalIntentType;
          selected_plan: BrandPlanTier;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          start_date?: string;
          end_date: string;
          status?: TrialStatusType;
          renewal_intent?: RenewalIntentType;
          selected_plan?: BrandPlanTier;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          start_date?: string;
          end_date?: string;
          status?: TrialStatusType;
          renewal_intent?: RenewalIntentType;
          selected_plan?: BrandPlanTier;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      admin_audit_events: {
        Row: {
          id: string;
          actor_id: string;
          target_brand_id: string | null;
          target_type: string;
          target_id: string | null;
          action: string;
          safe_summary: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          target_brand_id?: string | null;
          target_type: string;
          target_id?: string | null;
          action: string;
          safe_summary?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          target_brand_id?: string | null;
          target_type?: string;
          target_id?: string | null;
          action?: string;
          safe_summary?: Json;
          created_at?: string;
        };
      };
    };
    Views: {
      brands_public: {
        Row: {
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          tagline?: string | null;
          description?: string | null;
          website?: string | null;
          instagram?: string | null;
          city?: string | null;
          country?: string;
          shapes?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          tagline?: string | null;
          description?: string | null;
          website?: string | null;
          instagram?: string | null;
          city?: string | null;
          country?: string;
          shapes?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Convenient Row Shorthands
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
export type BrandPublicRow = Database["public"]["Views"]["brands_public"]["Row"];
export type BrandMemberRow = Database["public"]["Tables"]["brand_members"]["Row"];
export type SizingChartRow = Database["public"]["Tables"]["sizing_charts"]["Row"];
export type SizingChartEntryRow = Database["public"]["Tables"]["sizing_chart_entries"]["Row"];
export type MeasurementProfileRow = Database["public"]["Tables"]["measurement_profiles"]["Row"];
export type BrandTrialRow = Database["public"]["Tables"]["brand_trials"]["Row"];
export type AdminAuditEventRow = Database["public"]["Tables"]["admin_audit_events"]["Row"];
