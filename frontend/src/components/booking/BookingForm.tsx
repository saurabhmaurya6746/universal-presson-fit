import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { submitBookingRequest } from "@/services/bookingService";
import type {
  BookingFormData,
  BookingNailSizeProfile,
  NailSizeResult,
  StructuredNailSizes,
} from "@/types";

export interface BookingFormProps {
  onSuccess: () => void;
}

export const STANDARD_NAIL_SIZES = [
  "Size 0",
  "Size 1",
  "Size 2",
  "Size 3",
  "Size 4",
  "Size 5",
  "Size 6",
  "Size 7",
  "Size 8",
  "Size 9",
  "Size 10",
  "Size 11",
  "Size 12",
];

const inputStyle =
  "mt-2 h-12 w-full border border-input bg-background px-4 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20";

const servicesList = [
  "Nail Extensions",
  "Custom Press-On Nails",
  "Custom Nail Art",
  "Bridal / Event Nails",
  "Custom Sets",
];

interface LocationState {
  source?: "ai" | "manual";
  sizeResult?: NailSizeResult;
}

function extractSizesFromAi(result: NailSizeResult | null): StructuredNailSizes {
  const sizes: StructuredNailSizes = {
    index: "",
    middle: "",
    ring: "",
    pinky: "",
    thumb: "",
  };

  if (!result) return sizes;

  const items =
    result.measurements && result.measurements.length > 0
      ? result.measurements
      : result.leftHand || [];

  for (const item of items) {
    const f = item.finger.toLowerCase();
    const rawVal = String(item.recommended_size || item.size || "").trim();
    const cleanNum = rawVal.replace(/^size\s*/i, "");

    if (f.includes("thumb")) sizes.thumb = cleanNum;
    else if (f.includes("index")) sizes.index = cleanNum;
    else if (f.includes("middle")) sizes.middle = cleanNum;
    else if (f.includes("ring")) sizes.ring = cleanNum;
    else if (f.includes("pinky") || f.includes("little")) sizes.pinky = cleanNum;
  }

  return sizes;
}

function resolveBookingMode(state: LocationState | undefined): {
  mode: "ai" | "manual";
  aiResult: NailSizeResult | null;
} {
  // Case 1: Arriving directly from AI Size Finder via route navigation
  if (state?.source === "ai" && state.sizeResult) {
    try {
      sessionStorage.setItem("aura_active_ai_booking", JSON.stringify(state.sizeResult));
    } catch {
      // ignore storage error
    }
    return { mode: "ai", aiResult: state.sizeResult };
  }

  // Case 2: User refreshed on /booking after previously coming from AI
  const isReload =
    typeof performance !== "undefined" &&
    ((performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming)?.type ===
      "reload" ||
      (performance as unknown as { navigation?: { type: number } }).navigation?.type === 1);

  if (isReload) {
    try {
      const saved = sessionStorage.getItem("aura_active_ai_booking");
      if (saved) {
        return { mode: "ai", aiResult: JSON.parse(saved) as NailSizeResult };
      }
    } catch {
      // ignore parse error
    }
  }

  // Case 3: Direct visit or navigation from Header/Footer -> manual sizing mode
  try {
    sessionStorage.removeItem("aura_active_ai_booking");
  } catch {
    // ignore
  }
  return { mode: "manual", aiResult: null };
}

export function BookingForm({ onSuccess }: BookingFormProps) {
  const location = useLocation();
  const state = location.state as LocationState | undefined;

  const [bookingMode] = useState<{
    mode: "ai" | "manual";
    aiResult: NailSizeResult | null;
  }>(() => resolveBookingMode(state));

  const [manualSizes, setManualSizes] = useState<StructuredNailSizes>(() => {
    if (bookingMode.mode === "ai") {
      return extractSizesFromAi(bookingMode.aiResult);
    }
    return {
      thumb: "",
      index: "",
      middle: "",
      ring: "",
      pinky: "",
    };
  });

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    service: "",
    preferredDate: "",
    preferredTime: "",
    designPreference: "",
    additionalNotes: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleManualSizeChange = (finger: keyof StructuredNailSizes, value: string) => {
    setManualSizes((prev) => ({ ...prev, [finger]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const activeSizes: StructuredNailSizes =
      bookingMode.mode === "ai"
        ? extractSizesFromAi(bookingMode.aiResult)
        : manualSizes;

    const nailSizeProfile: BookingNailSizeProfile = {
      source: bookingMode.mode,
      sizes: activeSizes,
      measurements: bookingMode.aiResult?.measurements || bookingMode.aiResult?.leftHand,
      summary:
        bookingMode.mode === "ai"
          ? bookingMode.aiResult?.summaryProfile
          : Object.entries(activeSizes)
              .filter(([_, val]) => Boolean(val))
              .map(
                ([finger, val]) =>
                  `${finger.charAt(0).toUpperCase() + finger.slice(1)}: Size ${val}`
              )
              .join(", "),
    };

    const payload: BookingFormData = {
      ...formData,
      nailSizeProfile,
      aiSizeProfile: nailSizeProfile.summary,
      aiMeasurements: nailSizeProfile.measurements,
    };

    try {
      const res = await submitBookingRequest(payload);
      if (res.success) {
        onSuccess();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(res.message);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fingerItems =
    bookingMode.aiResult?.measurements && bookingMode.aiResult.measurements.length > 0
      ? bookingMode.aiResult.measurements
      : bookingMode.aiResult?.leftHand || [];

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto grid max-w-4xl gap-6 bg-card p-6 shadow-luxe sm:p-12"
    >
      {error && (
        <div role="alert" className="p-4 text-sm text-destructive bg-destructive/10 rounded">
          {error}
        </div>
      )}

      {/* Basic Contact & Service Details */}
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Name <span className="text-destructive">*</span>
          <input
            required
            maxLength={100}
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Your full name"
            className={inputStyle}
          />
        </label>

        <label className="text-sm font-medium">
          Phone <span className="text-destructive">*</span>
          <input
            required
            type="tel"
            maxLength={20}
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="Phone or WhatsApp number"
            className={inputStyle}
          />
        </label>

        <label className="text-sm font-medium">
          Email <span className="text-destructive">*</span>
          <input
            required
            type="email"
            maxLength={255}
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="your.email@example.com"
            className={inputStyle}
          />
        </label>

        <label className="text-sm font-medium">
          Service <span className="text-destructive">*</span>
          <select
            required
            name="service"
            value={formData.service}
            onChange={handleChange}
            className={inputStyle}
          >
            <option value="">Select a service</option>
            {servicesList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium">
          Preferred Date <span className="text-destructive">*</span>
          <input
            required
            type="date"
            name="preferredDate"
            value={formData.preferredDate}
            onChange={handleChange}
            className={inputStyle}
          />
        </label>

        <label className="text-sm font-medium">
          Preferred Time <span className="text-destructive">*</span>
          <input
            required
            type="time"
            name="preferredTime"
            value={formData.preferredTime}
            onChange={handleChange}
            className={inputStyle}
          />
        </label>
      </div>

      {/* Nail Size Profile Section: State A (AI Verified) vs State B (Manual Sizing) */}
      <div className="rounded-lg border border-border bg-lavender/15 p-5 sm:p-6">
        {bookingMode.mode === "ai" && bookingMode.aiResult ? (
          /* STATE A — USER COMES FROM AI SIZE FINDER (READ-ONLY AI VERIFIED) */
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl sm:text-2xl text-foreground">
                    AI Nail Size Profile
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-foreground">
                    <Check className="size-3 text-emerald-600" />
                    AI Verified
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  These sizes were detected by Aura Nails AI Size Finder.
                </p>
              </div>

              <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                <Link to="/ai-nail-size-finder">
                  Re-measure with AI
                </Link>
              </Button>
            </div>

            {/* Read-only verified dynamic cards */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {fingerItems.map((item) => (
                <div
                  key={item.finger}
                  className="flex flex-col items-center justify-center rounded-md border border-border/70 bg-card p-3.5 text-center shadow-xs select-none"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {item.finger}
                  </span>
                  <span className="mt-1 font-display text-lg font-bold text-foreground sm:text-xl">
                    {item.recommended_size
                      ? item.recommended_size.toLowerCase().startsWith("size")
                        ? item.recommended_size
                        : `Size ${item.recommended_size}`
                      : `Size ${item.size}`}
                  </span>
                  {typeof item.width_mm === "number" && typeof item.height_mm === "number" && (
                    <span className="mt-1 text-[11px] font-mono text-muted-foreground">
                      {item.width_mm.toFixed(1)} × {item.height_mm.toFixed(1)} mm
                    </span>
                  )}
                </div>
              ))}
            </div>

            {bookingMode.aiResult.summaryProfile ? (
              <p className="mt-3 text-xs font-mono text-muted-foreground">
                Summary: {bookingMode.aiResult.summaryProfile}
              </p>
            ) : null}
          </div>
        ) : (
          /* STATE B — USER DIRECTLY OPENS BOOKING (MANUAL SIZING) */
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <h3 className="font-display text-xl sm:text-2xl text-foreground">
                  Nail Size Profile
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Don&apos;t know your AI size yet? You can enter your nail sizes manually, or use our AI Size Finder.
                </p>
              </div>

              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/ai-nail-size-finder">
                  <Sparkles className="size-3.5 text-primary" />
                  Find My Size with AI
                </Link>
              </Button>
            </div>

            {/* Manual dropdown selectors for each finger */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {(["index", "middle", "ring", "pinky", "thumb"] as const).map((finger) => {
                const isThumb = finger === "thumb";
                const label = finger.charAt(0).toUpperCase() + finger.slice(1);
                const currentVal = manualSizes[finger];
                const selectValue = currentVal
                  ? currentVal.toLowerCase().startsWith("size")
                    ? currentVal
                    : `Size ${currentVal}`
                  : "";

                return (
                  <label key={finger} className="flex flex-col text-xs font-semibold text-foreground">
                    <span className="uppercase tracking-wider text-muted-foreground mb-1.5">
                      {label} {!isThumb && <span className="text-destructive">*</span>}
                    </span>
                    <select
                      value={selectValue}
                      onChange={(e) =>
                        handleManualSizeChange(finger, e.target.value.replace(/^size\s*/i, ""))
                      }
                      className="h-10 w-full rounded border border-input bg-card px-2.5 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                    >
                      <option value="">Select Size</option>
                      {STANDARD_NAIL_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <label className="text-sm font-medium">
        Design Preference <span className="text-destructive">*</span>
        <input
          required
          maxLength={200}
          name="designPreference"
          value={formData.designPreference}
          onChange={handleChange}
          placeholder="Minimal, French, chrome, floral…"
          className={inputStyle}
        />
      </label>

      <label className="text-sm font-medium">
        Additional Notes
        <textarea
          name="additionalNotes"
          value={formData.additionalNotes}
          onChange={handleChange}
          maxLength={1000}
          rows={4}
          placeholder="Tell us about inspiration, special requirements, or your event..."
          className="mt-2 w-full border border-input bg-background p-4 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
      </label>

      <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
        {loading ? "Submitting..." : "Request Appointment"}
      </Button>
    </form>
  );
}
