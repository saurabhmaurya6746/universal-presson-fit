import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  RotateCcw,
  Sliders,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import { resetDemoBrands } from "@/services/brandService";

export function AdminSettingsPage() {
  const [defaultTrialDays, setDefaultTrialDays] = useState<number>(10);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleResetData = () => {
    resetDemoBrands();
    setConfirmResetOpen(false);
    showToast("Demo brand registry has been reset to default initial state.");
  };

  return (
    <>
      <SEO
        title="Platform Admin Settings | PressOn Fit"
        description="Configure admin workspace preferences, trial defaults, and local demo data."
      />

      <div className="section-shell pt-8">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Admin Workspace
        </Link>
      </div>

      <PageIntro
        eyebrow="Platform Administration"
        title="Admin Workspace Settings"
      >
        Configure global trial duration presets and manage local demo evaluation data.
      </PageIntro>

      {/* Demo Notice */}
      <div className="section-shell pt-4">
        <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground">
          <ShieldAlert className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <strong className="text-foreground">Admin Workspace Demo:</strong> This panel configures frontend presentation preferences and local storage states. No server configuration is altered.
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

          {/* Trial Duration Presets Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <Sliders className="size-4 text-foreground" />
              <h3 className="text-base font-bold text-foreground">Trial & Sizing Presets</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                  Default New Brand Trial Duration
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={defaultTrialDays === 10 ? "default" : "outline"}
                    onClick={() => {
                      setDefaultTrialDays(10);
                      showToast("Default trial length set to 10 days.");
                    }}
                    className="h-7 text-xs font-semibold px-3"
                  >
                    10 Days (Default Standard)
                  </Button>
                  <Button
                    size="sm"
                    variant={defaultTrialDays === 14 ? "default" : "outline"}
                    onClick={() => {
                      setDefaultTrialDays(14);
                      showToast("Default trial length set to 14 days.");
                    }}
                    className="h-7 text-xs font-semibold px-3"
                  >
                    14 Days
                  </Button>
                  <Button
                    size="sm"
                    variant={defaultTrialDays === 30 ? "default" : "outline"}
                    onClick={() => {
                      setDefaultTrialDays(30);
                      showToast("Default trial length set to 30 days.");
                    }}
                    className="h-7 text-xs font-semibold px-3"
                  >
                    30 Days
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                  Optical Reference Standard
                </label>
                <input
                  type="text"
                  disabled
                  value="₹10 Indian Bi-Metallic Coin (27.00 mm diameter)"
                  className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-foreground font-medium outline-none cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Demo Data Management Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <RotateCcw className="size-4 text-foreground" />
              <h3 className="text-base font-bold text-foreground">Local Demo Data Reset</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              If you have made edits to brand charts, trial end dates, or visibility states and wish to revert back to the fresh initial demo dataset, click below:
            </p>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmResetOpen(true)}
                className="text-foreground border-border hover:bg-muted text-xs font-semibold"
              >
                Reset Demo Brand Registry to Defaults
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
      {confirmResetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-luxe space-y-4 animate-in zoom-in-95 duration-150">
            <h4 className="text-base font-bold text-foreground">Reset Demo Brands?</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will restore all sample brand studios, charts (Format A & B), and trial timestamps to their original state in this browser.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmResetOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleResetData}
                className="h-8 text-xs font-semibold"
              >
                Reset to Defaults
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminSettingsPage;
