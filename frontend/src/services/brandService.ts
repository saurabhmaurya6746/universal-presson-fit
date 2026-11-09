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
    id: "brand-presse",
    name: "PRESSE",
    slug: "presse",
    tagline: "Salon-Quality Press-On Nails Designed for Everyday Wear",
    description:
      "PRESSE offers reusable salon-grade press-on nails with precise millimeter sizing across standard XS through L sizing kits.",
    contactPerson: "PRESSE Concierge",
    contactEmail: "support@pressenails.com",
    website: "https://pressenails.com",
    instagram: "@pressenails",
    location: "New York, USA",
    status: "active",
    isDemo: false,
    is_official: true,
    logo_url: "/logos/presse.png",
    plan: "studio",
    profileVisibility: "public",
    chartVisibility: "public",
    shapes: ["Almond", "Square", "Coffin", "Oval"],
    submittedDate: "2026-11-08",
    adminNotes: "Official brand chart imported from user-provided sizing guide.",
    sizingChart: {
      id: "chart-presse-official",
      brandId: "brand-presse",
      chartName: "PRESSE Standard Sizing Guide",
      unit: "mm",
      format: "preset_set",
      is_official: true,
      verification_status: "user_provided",
      source_url: "https://pressenails.com/sizing-guide",
      source_notes: "Extracted from user-provided PRESSE sizing guide screenshot.",
      updatedDate: "2026-11-08",
      sourceType: "preset",
      customNotes: "The size chart lists measurements in mm for the widest points of each natural fingernail.",
      sizes: {
        XS: { thumb: 14, index: 10, middle: 11, ring: 10, pinky: 9 },
        S: { thumb: 15, index: 11, middle: 12, ring: 11, pinky: 9 },
        M: { thumb: 16, index: 12, middle: 13, ring: 12, pinky: 10 },
        L: { thumb: 17, index: 13, middle: 14, ring: 13, pinky: 10 },
      },
    },
  },
  {
    id: "brand-joyee",
    name: "Joyee",
    slug: "joyee",
    tagline: "Handmade Boutique Press-On Nails with Signature Inverted Sizing",
    description:
      "Joyee Nails creates bespoke handmade press-on sets numbered 0 to 9, where 0 is petite pinky and 9 is extra-wide thumb.",
    contactPerson: "Joyee Studio",
    contactEmail: "hello@joyeenails.com",
    website: "https://joyeenails.com",
    instagram: "@joyeenails",
    location: "California, USA",
    status: "active",
    isDemo: false,
    is_official: true,
    logo_url: "/logos/joyee.png",
    plan: "studio",
    profileVisibility: "public",
    chartVisibility: "public",
    shapes: ["Almond", "Coffin", "Square", "Oval", "Stiletto"],
    submittedDate: "2026-11-08",
    adminNotes: "Official brand chart imported with inverted sizing (#0 is smallest, #9 is largest).",
    sizingChart: {
      id: "chart-joyee-official",
      brandId: "brand-joyee",
      chartName: "Joyee Numbered Size Guide",
      unit: "mm",
      format: "numbered_size",
      is_official: true,
      verification_status: "user_provided",
      source_url: "https://joyeenails.com/pages/size-guide",
      source_notes: "Extracted from joyeenails.com sizing guide screenshot. Size 0 smallest, size 9 largest. Size 8 is a range.",
      updatedDate: "2026-11-08",
      sourceType: "manual",
      customNotes: "Important: Size 0 is smallest (~7mm) and Size 9 is largest (~17mm). Size 8 is a range (~15-16mm).",
      sizes: {},
      numbered_sizes: [
        { size: "0", width_mm: 7, is_approximate: true, typical_finger: "Pinky (petite hands)" },
        { size: "1", width_mm: 8, is_approximate: true, typical_finger: "Pinky (average hands)" },
        { size: "2", width_mm: 9, is_approximate: true, typical_finger: "Ring (petite)" },
        { size: "3", width_mm: 10, is_approximate: true, typical_finger: "Ring / Middle" },
        { size: "4", width_mm: 11, is_approximate: true, typical_finger: "Middle (average)" },
        { size: "5", width_mm: 12, is_approximate: true, typical_finger: "Index / Thumb (petite)" },
        { size: "6", width_mm: 13, is_approximate: true, typical_finger: "Thumb (average)" },
        { size: "7", width_mm: 14, is_approximate: true, typical_finger: "Thumb (wider)" },
        { size: "8", min_width_mm: 15, max_width_mm: 16, is_approximate: true, typical_finger: "Thumb (wide nail beds)" },
        { size: "9", width_mm: 17, is_approximate: true, typical_finger: "Thumb (extra wide)" },
      ],
    },
  },
  {
    id: "brand-glamnetic",
    name: "Glamnetic",
    slug: "glamnetic",
    tagline: "High-Quality Reusable Press-On Nails in Trendsetting Shapes",
    description:
      "Glamnetic provides high-performance salon press-on nails defined by rigorous shape-wise length and width millimeter specifications.",
    contactPerson: "Glamnetic Support",
    contactEmail: "support@glamnetic.com",
    website: "https://www.glamnetic.com",
    instagram: "@glamnetic",
    location: "Los Angeles, USA",
    status: "active",
    isDemo: false,
    is_official: true,
    logo_url: "/logos/glamnetic.png",
    plan: "studio",
    profileVisibility: "public",
    chartVisibility: "public",
    shapes: [
      "Extra Short Round", "Extra Short Square", "Extra Short Almond", "Extra Short Oval",
      "Super Short", "Short Oval", "Short Squoval", "Short Round", "Short Almond",
      "Medium Almond", "Medium Square", "Medium Coffin", "Medium Oval", "Long Coffin",
    ],
    submittedDate: "2026-11-08",
    adminNotes: "Official shape-based range chart with 14 shapes and 0.6mm thickness.",
    sizingChart: {
      id: "chart-glamnetic-official",
      brandId: "brand-glamnetic",
      chartName: "Glamnetic Shape-Based Dimension Guide",
      unit: "mm",
      format: "shape_range",
      is_official: true,
      verification_status: "user_provided",
      source_url: "https://www.glamnetic.com/pages/size-guide",
      source_notes: "Extracted from user-provided Glamnetic shape measurement specification chart.",
      updatedDate: "2026-11-08",
      sourceType: "manual",
      customNotes: "Shape-wise measurement ranges in millimeters with consistent 0.6mm thickness across all 14 shapes.",
      sizes: {},
      shape_ranges: [
        { shape: "Extra Short Round", length_min_mm: 11.40, length_max_mm: 16.65, width_min_mm: 6.50, width_max_mm: 13.95, thickness_mm: 0.6 },
        { shape: "Extra Short Square", length_min_mm: 11.50, length_max_mm: 16.70, width_min_mm: 6.50, width_max_mm: 13.90, thickness_mm: 0.6 },
        { shape: "Extra Short Almond", length_min_mm: 12.78, length_max_mm: 18.05, width_min_mm: 6.40, width_max_mm: 13.80, thickness_mm: 0.6 },
        { shape: "Extra Short Oval", length_min_mm: 11.42, length_max_mm: 16.70, width_min_mm: 6.50, width_max_mm: 13.80, thickness_mm: 0.6 },
        { shape: "Super Short", length_min_mm: 10.04, length_max_mm: 15.22, width_min_mm: 6.66, width_max_mm: 12.59, thickness_mm: 0.6 },
        { shape: "Short Oval", length_min_mm: 12.51, length_max_mm: 19.24, width_min_mm: 6.34, width_max_mm: 14.11, thickness_mm: 0.6 },
        { shape: "Short Squoval", length_min_mm: 12.45, length_max_mm: 18.51, width_min_mm: 6.72, width_max_mm: 14.17, thickness_mm: 0.6 },
        { shape: "Short Round", length_min_mm: 13.60, length_max_mm: 22.00, width_min_mm: 6.70, width_max_mm: 14.00, thickness_mm: 0.6 },
        { shape: "Short Almond", length_min_mm: 15.33, length_max_mm: 22.33, width_min_mm: 6.55, width_max_mm: 14.08, thickness_mm: 0.6 },
        { shape: "Medium Almond", length_min_mm: 18.69, length_max_mm: 24.18, width_min_mm: 6.55, width_max_mm: 14.08, thickness_mm: 0.6 },
        { shape: "Medium Square", length_min_mm: 15.30, length_max_mm: 19.55, width_min_mm: 6.51, width_max_mm: 13.90, thickness_mm: 0.6 },
        { shape: "Medium Coffin", length_min_mm: 15.58, length_max_mm: 21.29, width_min_mm: 6.29, width_max_mm: 13.98, thickness_mm: 0.6 },
        { shape: "Medium Oval", length_min_mm: 18.71, length_max_mm: 23.85, width_min_mm: 7.36, width_max_mm: 14.62, thickness_mm: 0.6 },
        { shape: "Long Coffin", length_min_mm: 19.81, length_max_mm: 25.94, width_min_mm: 6.39, width_max_mm: 14.08, thickness_mm: 0.6 },
      ],
    },
  },
  {
    id: "brand-the-nailest",
    name: "The Nailest",
    slug: "the-nailest",
    tagline: "Handmade Luxury Press-On Nails Designed with Precision Lengths",
    description:
      "The Nailest offers artisan handmade press-on nails in 10 signature shapes with exact millimeter length specifications across numbered tips #0 through #9.",
    contactPerson: "The Nailest Studio",
    contactEmail: "support@thenailest.com",
    website: "https://thenailest.com",
    instagram: "@thenailestco",
    location: "Los Angeles, United States",
    status: "active",
    isDemo: false,
    is_official: true,
    logo_url: "/logos/the-nailest.png",
    plan: "studio",
    profileVisibility: "public",
    chartVisibility: "public",
    shapes: [
      "Short Oval",
      "Short Square",
      "Regular Square",
      "Regular Coffin",
      "Regular Stiletto",
      "Regular Oval",
      "Regular Almond",
      "Long Square",
      "Long Coffin",
      "Long Stiletto",
    ],
    submittedDate: "2026-11-09",
    adminNotes: "Official brand length specification chart with 10 shapes and #0–#9 vertical lengths.",
    sizingChart: {
      id: "chart-the-nailest-official",
      brandId: "brand-the-nailest",
      chartName: "The Nailest Numbered Length Guide",
      unit: "mm",
      format: "length_only_numbered",
      is_official: true,
      verification_status: "user_provided",
      source_url: "https://thenailest.com/pages/sizing-chart",
      source_notes: "Extracted from user-provided The Nailest sizing chart screenshots.",
      updatedDate: "2026-11-09",
      sourceType: "manual",
      customNotes:
        "Length information is available, but width measurements are not provided by this brand. Numbered sizes from #0 (longest) to #9 (shortest). Length in mm is measured vertically from cuticle base to tip.",
      sizes: {},
      length_numbered_sizes: {
        "Short Oval": { "#0": 23, "#1": 22, "#2": 21, "#3": 20, "#4": 19, "#5": 18, "#6": 17, "#7": 16, "#8": 15, "#9": 15 },
        "Short Square": { "#0": 21, "#1": 20, "#2": 19, "#3": 19, "#4": 18, "#5": 18, "#6": 17, "#7": 16, "#8": 15, "#9": 14 },
        "Regular Square": { "#0": 24, "#1": 23, "#2": 22, "#3": 21, "#4": 20, "#5": 19, "#6": 18, "#7": 17, "#8": 16, "#9": 15 },
        "Regular Coffin": { "#0": 24, "#1": 23, "#2": 22, "#3": 21, "#4": 20, "#5": 19, "#6": 18, "#7": 17, "#8": 16, "#9": 15 },
        "Regular Stiletto": { "#0": 25, "#1": 24, "#2": 23, "#3": 22, "#4": 21, "#5": 20, "#6": 19, "#7": 18, "#8": 17, "#9": 16 },
        "Regular Oval": { "#0": 26, "#1": 25, "#2": 24, "#3": 23, "#4": 22, "#5": 21, "#6": 20, "#7": 19, "#8": 18, "#9": 17 },
        "Regular Almond": { "#0": 26, "#1": 25, "#2": 24, "#3": 23, "#4": 22, "#5": 21, "#6": 20, "#7": 19, "#8": 18, "#9": 17 },
        "Long Square": { "#0": 30, "#1": 29, "#2": 28, "#3": 27, "#4": 26, "#5": 25, "#6": 24, "#7": 23, "#8": 22, "#9": 21 },
        "Long Coffin": { "#0": 34, "#1": 33, "#2": 32, "#3": 31, "#4": 30, "#5": 29, "#6": 28, "#7": 27, "#8": 26, "#9": 25 },
        "Long Stiletto": { "#0": 37, "#1": 36, "#2": 35, "#3": 34, "#4": 33, "#5": 32, "#6": 31, "#7": 30, "#8": 29, "#9": 28 },
      },
    },
  },
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
