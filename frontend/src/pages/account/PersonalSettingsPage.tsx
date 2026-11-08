import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Ruler,
  Trash2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import { getCurrentUser } from "@/services/authService";

const SAVED_SCANS_KEY = "aura_saved_nail_sizes_v1";

export function PersonalSettingsPage() {
  const currentUser = getCurrentUser();
  const [preferredUnit, setPreferredUnit] = useState<"mm">("mm");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleClearSavedScans = () => {
    try {
      localStorage.removeItem(SAVED_SCANS_KEY);
      localStorage.removeItem("pressonfit_recent_scan_v1");
      setConfirmClearOpen(false);
      showToast("All locally saved measurement scans have been cleared.");
    } catch {
      showToast("Error clearing saved measurements.");
    }
  };

  return (
    <>
      <SEO
        title="Personal Account Settings | Nail World"
        description="Manage your account preferences, measurement unit, and saved hand scans."
      />

      <div className="section-shell pt-8">
        <Link
          to="/account"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Personal Profile
        </Link>
      </div>

      <PageIntro
        eyebrow="Personal Account"
        title="Account & Measurement Settings"
      >
        Customize your sizing units and manage locally cached scans and profile details.
      </PageIntro>

      {/* Demo Notice */}
      <div className="section-shell pt-4">
        <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground">
          <ShieldAlert className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <strong className="text-foreground">Local Demo Account:</strong> Your profile and preferences are stored in your browser's local cache. No passwords or personal data are sent to any external server.
          </div>
        </div>
      </div>

      <section className="section-shell py-8">
        <div className="max-w-3xl space-y-8">
          {toastMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Profile Details Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <User className="size-4 text-foreground" />
              <h3 className="text-base font-bold text-foreground">Profile Information</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  disabled
                  value={currentUser?.name || "Demo Customer"}
                  className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-foreground font-medium outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={currentUser?.email || "customer@example.com"}
                  className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-foreground font-medium outline-none cursor-not-allowed"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Profile details are tied to your current active demo session.
            </p>
          </div>

          {/* Measurement Preferences Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <Ruler className="size-4 text-foreground" />
              <h3 className="text-base font-bold text-foreground">Measurement Preferences</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1.5">
                  Default Sizing Unit
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-primary/40 bg-primary/5 text-foreground font-semibold">
                    <input
                      type="radio"
                      name="unit"
                      checked={preferredUnit === "mm"}
                      onChange={() => setPreferredUnit("mm")}
                      className="accent-primary"
                    />
                    <span>Millimeters (mm) — Standard Universal Precision</span>
                  </label>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                All Nail World partner sizing charts calibrate width specifications in precise millimeters calibrated via optical ₹10 coin scaling.
              </p>
            </div>
          </div>

          {/* Privacy & Saved Scans Management Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <Trash2 className="size-4 text-destructive" />
              <h3 className="text-base font-bold text-foreground">Saved Scans & Data Management</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              When you measure your hand using the AI Nail Size Finder, estimated millimeter widths are temporarily stored in your browser's local storage so you can easily compare brand sizing charts.
            </p>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmClearOpen(true)}
                className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs font-semibold"
              >
                Clear All Saved Measurement Scans
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
      {confirmClearOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-luxe space-y-4 animate-in zoom-in-95 duration-150">
            <h4 className="text-base font-bold text-foreground">Clear Saved Scans?</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to remove all saved hand measurements from this browser? You can retake a photo anytime using the AI Size Finder.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmClearOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleClearSavedScans}
                className="h-8 text-xs font-semibold"
              >
                Yes, Clear Scans
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PersonalSettingsPage;
