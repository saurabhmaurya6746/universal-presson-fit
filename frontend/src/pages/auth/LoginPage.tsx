import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ArrowRight,
  Ruler,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import { authAdapter } from "@/services/authAdapter";

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setFeedbackNotice("");

    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await authAdapter.login(email, password);
      setIsSubmitting(false);

      if (res.success && res.redirectTo) {
        navigate(res.redirectTo);
      } else {
        setErrorMessage(
          res.error || "Unable to sign in. Please verify your email or create an account."
        );
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage("An unexpected authentication error occurred.");
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage("");
    setFeedbackNotice("");

    if (!email.trim()) {
      setErrorMessage("Please enter your email address above to receive reset instructions.");
      return;
    }

    try {
      const res = await authAdapter.sendPasswordReset(email);
      if (res.success) {
        setFeedbackNotice(res.message || "Password reset email sent. Please check your inbox.");
      } else {
        setErrorMessage(res.error || "Failed to send password reset email.");
      }
    } catch {
      setErrorMessage("An error occurred while requesting password reset.");
    }
  };

  return (
    <>
      <SEO
        title="Sign In | PressOn Fit"
        description="Sign in to your PressOn Fit account to access your saved nail size profiles or brand dashboard."
      />

      <div className="relative min-h-[calc(100vh-4.5rem)] py-12 px-4 sm:px-6 flex flex-col justify-center items-center overflow-hidden">
        {/* Subtle delicate floral / lacquer ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-40 dark:opacity-20"
        >
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 size-96 rounded-full bg-gradient-to-b from-lavender/40 to-blush/30 blur-3xl" />
          <div className="absolute -bottom-24 right-10 size-80 rounded-full bg-gradient-to-tr from-champagne/40 to-lavender/30 blur-3xl" />
        </div>

        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Welcome to PressOn Fit
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
              Sign in to your account.
            </p>
          </div>

          {/* Main Login Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Informational Feedback */}
              {feedbackNotice && (
                <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/50 p-3 text-xs text-foreground">
                  <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{feedbackNotice}</span>
                </div>
              )}

              {/* Email Field */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-muted-foreground mb-1.5"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                />
              </div>

              {/* Password Field with Show/Hide Control */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-muted-foreground"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
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

              {/* Remember Me */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  id="login-remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded border-border text-foreground accent-foreground cursor-pointer"
                />
                <label
                  htmlFor="login-remember"
                  className="text-xs text-muted-foreground cursor-pointer select-none"
                >
                  Remember me
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full justify-center py-2.5 text-sm font-semibold mt-2"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Registration link */}
            <div className="mt-5 pt-5 border-t border-border/60 text-center text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-semibold text-foreground hover:underline"
              >
                Create an account
              </Link>
            </div>
          </div>

          {/* Unobtrusive Guest Measurement Link */}
          <div className="mt-6 text-center">
            <Link
              to="/ai-nail-size-finder"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
            >
              <Ruler className="size-3.5 group-hover:rotate-12 transition-transform" />
              <span>Measure without signing in</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {/* Subtle footer note (dynamic between Demo and API Auth) */}
          <p className="mt-4 text-center text-[11px] text-muted-foreground/80">
            {authAdapter.isRemoteEnabled() ? (
              <span>Protected by PressOn Fit API Authentication.</span>
            ) : (
              <span>Preview access • Authentication is in local demonstration mode.</span>
            )}
          </p>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
