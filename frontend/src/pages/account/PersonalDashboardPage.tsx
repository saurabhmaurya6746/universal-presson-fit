import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  User,
  LogOut,
  Ruler,
  ArrowRight,
  Info,
  Clock,
  Trash2,
  Copy,
  Check,
  PlusCircle,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import { authAdapter } from "@/services/authAdapter";
import { useAuthUser } from "@/hooks/useAuthUser";
import { measurementApiService } from "@/services/measurementApiService";

interface SavedFingerMeasurement {
  finger: string;
  width_mm?: number;
  size?: string;
  colorHex?: string;
}

interface SavedScanProfile {
  id: string;
  nickname: string;
  savedAt: string;
  summary?: string;
  measurements?: SavedFingerMeasurement[];
}

const DEMO_SAMPLE_SCAN: SavedScanProfile = {
  id: "prof-sample-" + Date.now(),
  nickname: "Natural Everyday Oval Fit",
  savedAt: new Date().toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
  summary: "Thumb: 0 (14.8mm), Index: 4 (11.6mm), Middle: 3 (12.4mm), Ring: 5 (10.9mm), Pinky: 7 (8.5mm)",
  measurements: [
    { finger: "Thumb", width_mm: 14.8, size: "0", colorHex: "#3b82f6" },
    { finger: "Index", width_mm: 11.6, size: "4", colorHex: "#10b981" },
    { finger: "Middle", width_mm: 12.4, size: "3", colorHex: "#f59e0b" },
    { finger: "Ring", width_mm: 10.9, size: "5", colorHex: "#ec4899" },
    { finger: "Pinky", width_mm: 8.5, size: "7", colorHex: "#8b5cf6" },
  ],
};

export function PersonalDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuthUser();
  const [savedProfiles, setSavedProfiles] = useState<SavedScanProfile[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, user, navigate]);

  useEffect(() => {
    let isMounted = true;
    const loadProfiles = async () => {
      setProfileError(null);
      if (user && !user.isDemoSession) {
        // Real authenticated account: fetch from API, NEVER fall back to demo local storage
        const result = await measurementApiService.getProfiles();
        if (!isMounted) return;

        if (!result.success) {
          // Failed to load: record error message and keep profiles empty; never load demo data
          setProfileError(result.error || "Failed to load saved measurement profiles from server.");
          setSavedProfiles([]);
          return;
        }

        // Successfully loaded: 0 or more profiles
        const mapped: SavedScanProfile[] = (result.profiles || []).map((p) => {
          const rawMeasurements = Array.isArray(p.measurements)
            ? p.measurements
            : Object.entries(p.measurements || {}).map(([f, w]) => ({
                finger: f,
                width_mm: typeof w === "number" ? w : Number(w),
              }));
          const summary =
            p.summary_profile ||
            rawMeasurements
              .map((m: any) => `${m.finger}: ${m.size ? `${m.size} ` : ""}(${m.width_mm}mm)`)
              .join(", ");
          return {
            id: p.id,
            nickname: p.nickname || p.profile_name || "Saved Fit",
            savedAt: p.created_at
              ? new Date(p.created_at).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Recent",
            summary,
            measurements: rawMeasurements.map((m: any) => ({
              finger: m.finger,
              width_mm: m.width_mm,
              size: m.size || m.recommended_size,
              colorHex: m.colorHex,
            })),
          };
        });
        setSavedProfiles(mapped);
        return;
      }

      // Explicit Demo Session ONLY: load from demo local storage
      try {
        const raw = localStorage.getItem("presson_fit_saved_profiles_demo");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && isMounted) {
            setSavedProfiles(parsed);
          }
        }
      } catch {
        if (isMounted) setSavedProfiles([]);
      }
    };

    void loadProfiles();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Smooth scroll to history section if requested via hash
  useEffect(() => {
    if (location.hash === "#history") {
      const el = document.getElementById("history");
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [location.hash]);

  const handleLogout = async () => {
    await authAdapter.logout();
    navigate("/login");
  };

  const handleDeleteProfile = async (id: string) => {
    setProfileError(null);
    if (user && !user.isDemoSession) {
      const res = await measurementApiService.deleteProfile(id);
      if (res.success) {
        // Only update UI after successful remote deletion
        setSavedProfiles((prev) => prev.filter((p) => p.id !== id));
      } else {
        // Preserve the profile in UI and show error
        setProfileError(res.error || "Failed to delete measurement profile from server.");
      }
      return;
    }

    const updated = savedProfiles.filter((p) => p.id !== id);
    setSavedProfiles(updated);
    try {
      localStorage.setItem("presson_fit_saved_profiles_demo", JSON.stringify(updated));
    } catch {
      // storage fallback
    }
  };

  const handleAddSampleScan = async () => {
    setProfileError(null);
    if (user && !user.isDemoSession) {
      const res = await measurementApiService.createProfile({
        nickname: "Natural Everyday Oval Fit",
        hand_side: "right",
        measurements:
          DEMO_SAMPLE_SCAN.measurements?.map((m) => ({
            finger: m.finger,
            width_mm: m.width_mm || 0,
            size: m.size,
          })) || [],
        summary_profile: DEMO_SAMPLE_SCAN.summary,
      });
      if (res.success && res.profile) {
        const created = res.profile;
        const newProfile: SavedScanProfile = {
          id: created.id,
          nickname: created.nickname,
          savedAt: new Date(created.created_at).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          summary: created.summary_profile || DEMO_SAMPLE_SCAN.summary,
          measurements: DEMO_SAMPLE_SCAN.measurements,
        };
        setSavedProfiles((prev) => [newProfile, ...prev]);
      } else {
        // Show error and DO NOT store demo profile locally
        setProfileError(res.error || "Failed to save measurement profile to server.");
      }
      return;
    }

    const newProfile = {
      ...DEMO_SAMPLE_SCAN,
      id: "prof-" + Date.now(),
      savedAt: new Date().toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
    const updated = [newProfile, ...savedProfiles];
    setSavedProfiles(updated);
    try {
      localStorage.setItem("presson_fit_saved_profiles_demo", JSON.stringify(updated.slice(0, 10)));
    } catch {
      // storage fallback
    }
  };

  const handleCopyProfile = (profile: SavedScanProfile) => {
    const text = profile.summary || `${profile.nickname} scan on ${profile.savedAt}`;
    navigator.clipboard.writeText(text);
    setCopiedId(profile.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (isLoading) {
    return <div className="section-shell py-16 text-center text-sm text-muted-foreground">Loading your profile…</div>;
  }

  if (!user) return null;

  return (
    <>
      <SEO
        title="My Nail Account | PressOn Fit"
        description="View your saved nail profiles and measurement history on PressOn Fit."
      />

      <PageIntro
        eyebrow="Customer Profile"
        title={user ? `Welcome back, ${user.name}` : "My Nail Profile"}
      >
        Manage your personal nail width estimates and quickly match against boutique press-on brand charts.
      </PageIntro>

      <section className="section-shell py-10">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Subtle Demo Status Note */}
          <div className="rounded-xl border border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Info className="size-4 text-muted-foreground shrink-0" />
              <span>
                {user.isDemoSession ? (
                  <><strong>Demo Session Active:</strong> This profile is using the browser demo account.</>
                ) : (
                  <><strong>PressOn Fit API connected:</strong> You are signed in to the business backend with synchronized personal measurement profiles.</>
                )}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 font-semibold text-destructive hover:underline shrink-0"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>

          {/* Error Banner when remote profile request fails */}
          {profileError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Profile Synchronization Error</strong>
                <span>{profileError}</span>
              </div>
            </div>
          )}

          {/* Account Overview Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xs">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-foreground shrink-0">
                <User className="size-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">
                    {user?.name || "Customer Account"}
                  </h2>
                  <span className="rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[10px] font-semibold uppercase">
                    {user.isDemoSession ? "Personal Demo" : "Personal Account"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {user?.email || "customer@example.com"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button asChild size="sm" className="gap-2 flex-1 sm:flex-initial">
                <Link to="/ai-nail-size-finder">
                  <Ruler className="size-4" />
                  Measure Nails
                </Link>
              </Button>
            </div>
          </div>

          {/* Sizing History / Saved Profiles Section */}
          <div id="history" className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 scroll-mt-24 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">
                    Profile & Scan History
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Natural nail widths estimated with optical ₹10 coin calibration.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddSampleScan}
                  className="gap-1.5 text-xs h-8"
                >
                  <PlusCircle className="size-3.5" />
                  Add Demo Scan
                </Button>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/60 px-2.5 py-1 rounded-md">
                  Local storage
                </span>
              </div>
            </div>

            {/* Saved Scan List */}
            {savedProfiles.length > 0 ? (
              <div className="space-y-4">
                {savedProfiles.map((profile, idx) => (
                  <div
                    key={profile.id || idx}
                    className="rounded-xl border border-border bg-muted/15 p-5 space-y-3.5 transition-all hover:border-border/80"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                          #{idx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-foreground text-sm">
                            {profile.nickname || "Nail Fit Profile"}
                          </h4>
                          <span className="text-[11px] text-muted-foreground">
                            Saved on {profile.savedAt || "Recent scan"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyProfile(profile)}
                          className="h-7 text-xs gap-1 px-2.5"
                        >
                          {copiedId === profile.id ? (
                            <>
                              <Check className="size-3 text-emerald-500" />
                              <span className="text-emerald-600 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3" />
                              <span>Copy Sizes</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProfile(profile.id)}
                          className="h-7 text-xs text-destructive hover:text-destructive px-2"
                          title="Delete from history"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Finger breakdown */}
                    {profile.measurements && profile.measurements.length > 0 ? (
                      <div className="grid grid-cols-5 gap-2 pt-1 text-center">
                        {profile.measurements.map((m, mIdx) => (
                          <div
                            key={mIdx}
                            className="rounded-lg border border-border bg-card p-2 relative overflow-hidden"
                          >
                            <div
                              className="absolute top-0 left-0 right-0 h-1"
                              style={{ backgroundColor: m.colorHex || "#a855f7" }}
                            />
                            <div className="text-[10px] font-semibold text-muted-foreground uppercase mt-0.5">
                              {m.finger}
                            </div>
                            <div className="mt-1 text-xs font-bold text-foreground">
                              {m.width_mm ? `${m.width_mm.toFixed(1)} mm` : "—"}
                            </div>
                            {m.size && (
                              <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                                Size {m.size}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border bg-card p-3 text-xs text-foreground font-mono">
                        {profile.summary || "Natural nail width profile recorded."}
                      </div>
                    )}

                    <div className="pt-1 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Sparkles className="size-3 text-primary" />
                        <span>Calibrated against ₹10 coin standard</span>
                      </div>
                      <Link
                        to="/brands"
                        className="font-semibold text-primary hover:underline inline-flex items-center gap-1 text-[11px]"
                      >
                        Compare with Studio Brand Charts
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Empty State when no real saved scans exist */
              <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-4 bg-muted/10">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <Ruler className="size-6 text-muted-foreground" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="text-sm font-bold text-foreground">
                    No saved natural nail scans recorded yet
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Take a top-down photo of your hand with a ₹10 reference coin to calculate your natural nail widths in millimeters and save your personal size profile.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <Button asChild size="sm" className="gap-2">
                    <Link to="/ai-nail-size-finder">
                      <Ruler className="size-4" />
                      Measure My Nails Now
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddSampleScan}
                    className="gap-1.5 text-xs"
                  >
                    <PlusCircle className="size-3.5" />
                    Load Sample Scan
                  </Button>
                </div>
              </div>
            )}

            {/* Standard Reference Info Card */}
            <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <h4 className="text-xs font-semibold text-foreground">
                    Universal Millimeter Standard Reference
                  </h4>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  ₹10 Coin: 27.0 mm diameter
                </span>
              </div>

              {/* Sample standard reference finger sizes */}
              <div className="grid grid-cols-5 gap-2 pt-1 text-center">
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Thumb</div>
                  <div className="mt-1 text-xs font-bold text-foreground">14.0–16.0 mm</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Index</div>
                  <div className="mt-1 text-xs font-bold text-foreground">11.0–12.5 mm</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Middle</div>
                  <div className="mt-1 text-xs font-bold text-foreground">12.0–13.5 mm</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Ring</div>
                  <div className="mt-1 text-xs font-bold text-foreground">10.5–12.0 mm</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Pinky</div>
                  <div className="mt-1 text-xs font-bold text-foreground">8.0–9.5 mm</div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Standard Fit Range: <strong>Sizes XS to XL available across partner brands</strong></span>
                <Link
                  to="/how-sizing-works"
                  className="font-semibold text-foreground hover:underline inline-flex items-center gap-1 text-[11px]"
                >
                  Learn how sizing works
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default PersonalDashboardPage;
