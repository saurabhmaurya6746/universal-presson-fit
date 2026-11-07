import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import { authAdapter } from "@/services/authAdapter";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authAdapter.updatePassword(password);
      setIsSubmitting(false);

      if (res.success) {
        setSuccessMessage(res.message || "Your password has been reset successfully.");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setErrorMessage(res.error || "Failed to reset password.");
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage("An unexpected error occurred while resetting your password.");
    }
  };

  return (
    <>
      <SEO
        title="Reset Password | PressOn Fit"
        description="Choose a new password for your PressOn Fit account."
      />

      <div className="relative min-h-[calc(100vh-4.5rem)] py-12 px-4 sm:px-6 flex flex-col justify-center items-center overflow-hidden">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Set New Password
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
              Please enter your new password below.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
            {successMessage ? (
              <div className="space-y-4 text-center py-4">
                <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
                <h3 className="font-display text-lg font-bold text-foreground">Password Updated</h3>
                <p className="text-xs text-muted-foreground">{successMessage}</p>
                <p className="text-xs text-muted-foreground">Redirecting to sign in...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="reset-password"
                    className="block text-xs font-semibold text-muted-foreground mb-1.5"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-xs font-semibold text-muted-foreground mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="reset-confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full justify-center py-2.5 text-sm font-semibold mt-2"
                >
                  {isSubmitting ? "Updating Password..." : "Update Password"}
                </Button>
              </form>
            )}

            <div className="mt-5 pt-5 border-t border-border/60 text-center text-xs text-muted-foreground">
              Remember your credentials?{" "}
              <Link to="/login" className="font-semibold text-foreground hover:underline">
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
