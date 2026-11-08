/**
 * Nail World — Global Brand & Attribution Configuration
 * 
 * Centralized configuration for customer-facing branding, attribution,
 * platform descriptors, and official support contact information.
 *
 * Product brand: Nail World
 * Parent company: TechHelp Solutions
 * Tagline: Perfect Fit. Every Time.
 */

export const brandConfig = {
  // Core Brand Identity
  brandName: "Nail World",
  brandNameUpper: "NAIL WORLD",
  shortName: "Nail World",
  productDescriptor: "Universal Press-On Nail Sizing",
  platformTitle: "Nail World | Universal Press-On Nail Sizing Platform",
  tagline: "Perfect Fit. Every Time.",

  // Corporate Attribution
  parentCompany: "TechHelp Solutions",
  attribution: "A product by TechHelp Solutions",
  creatorAttribution: "Developed & owned by TechHelp Solutions",

  // Centralized Customer-Facing Support & Inquiries Email
  // Update this single source when a custom domain email becomes active
  supportEmail: "nailworld.support@gmail.com",

  // Platform Meta & Descriptions
  metaDescription:
    "Nail World: Universal AI-powered press-on nail sizing platform by TechHelp Solutions. Perfect Fit. Every Time. Measure your natural fingernails in millimeters using physical coin scale calibration and find your perfect size for any press-on nail brand.",
  ogDescription:
    "Nail World — Universal AI-powered press-on nail sizing platform by TechHelp Solutions. Perfect Fit. Every Time. Measure in millimeters, fit any brand.",

  // Platform Summary
  summary:
    "Estimate natural fingernail widths in millimeters using a ₹10 reference coin. Compare with sizing charts from different press-on studios for a flawless fit every time.",

  // Footer & Copyright
  copyrightYear: 2026,
  get copyright() {
    return `© ${this.copyrightYear} ${this.brandName}. All rights reserved. ${this.attribution}.`;
  },
} as const;
