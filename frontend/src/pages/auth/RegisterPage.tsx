import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  User,
  Building2,
  CheckCircle2,
  AlertCircle,
  Ruler,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";
import { authAdapter } from "@/services/authAdapter";

export function RegisterPage() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<"personal" | "brand">("personal");

  // Personal form state
  const [personalName, setPersonalName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalPassword, setPersonalPassword] = useState("");
  const [personalConfirmPassword, setPersonalConfirmPassword] = useState("");
  const [personalAgreeTerms, setPersonalAgreeTerms] = useState(false);

  // Brand form state
  const [brandName, setBrandName] = useState("");
  const [contactName, setContactName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [brandPassword, setBrandPassword] = useState("");
  const [brandConfirmPassword, setBrandConfirmPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [location, setLocation] = useState("");
  const [brandAgreeTerms, setBrandAgreeTerms] = useState(false);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage("");
    setSuccessNotice("");

    if (!personalName.trim() || !personalEmail.trim()) {
      setErrorMessage("Please provide your full name and email address.");
      return;
    }

    if (!personalPassword || personalPassword.length < 8) {
      setErrorMessage("Please enter a password with at least 8 characters.");
      return;
    }

    if (personalPassword !== personalConfirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!personalAgreeTerms) {
      setErrorMessage("Please accept the terms and privacy consent.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authAdapter.registerPersonal(
        {
          name: personalName,
          email: personalEmail,
        },
        personalPassword
      );

      if (res.success) {
        const registeredEmail = personalEmail.trim().toLowerCase();
        if (res.verificationRequired) {
          const msg =
            res.message ||
            "Account created! Please check your email inbox to verify your address before signing in.";
          setSuccessNotice(msg);
          setTimeout(() => {
            navigate("/login", {
              state: {
                email: registeredEmail,
                notice: "Please verify your email address, then enter your password to sign in.",
              },
            });
          }, 2000);
        } else {
          setSuccessNotice(
            res.message || "Account created successfully! Redirecting to Sign In..."
          );
          setTimeout(() => {
            navigate("/login", {
              state: {
                email: registeredEmail,
                notice: "Account created successfully! Please enter your password to sign in.",
              },
            });
          }, 1200);
        }
      } else {
        setIsSubmitting(false);
        setErrorMessage(res.error || "Failed to create personal account.");
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage("An unexpected registration error occurred. Please try again.");
    }
  };

  const handleBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage("");
    setSuccessNotice("");

    if (!brandName.trim() || !contactName.trim() || !businessEmail.trim()) {
      setErrorMessage("Please fill in your brand name, contact person, and business email.");
      return;
    }

    if (!website.trim() && !instagram.trim()) {
      setErrorMessage("Please provide at least one studio link: website URL or Instagram handle.");
      return;
    }

    if (!brandPassword || brandPassword.length < 8) {
      setErrorMessage("Please enter a password with at least 8 characters.");
      return;
    }

    if (brandPassword !== brandConfirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!brandAgreeTerms) {
      setErrorMessage("Please accept the terms and partner consent.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authAdapter.registerBrand(
        {
          brandName,
          contactName,
          businessEmail,
          website,
          instagram,
          location: location.trim() || "India",
        },
        brandPassword
      );

      if (res.success) {
        if (res.redirectTo === "/login") {
          const registeredEmail = businessEmail.trim().toLowerCase();
          const msg =
            "Studio partner application received! Once verified, your studio account will be activated. Redirecting to Sign In...";
          setSuccessNotice(msg);
          setTimeout(() => {
            navigate("/login", {
              state: {
                email: registeredEmail,
                notice: "Studio application received! Please sign in with your credentials.",
              },
            });
          }, 2000);
        } else if (res.redirectTo) {
          navigate(res.redirectTo);
        }
      } else {
        setIsSubmitting(false);
        setErrorMessage(res.error || "Failed to create brand studio account.");
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage("An unexpected registration error occurred. Please try again.");
    }
  };

  return (
    <>
      <SEO
        title="Create an Account | Nail World"
        description="Register for a Personal Nail Account or Brand Studio Partner Account with a 10-day free trial on Nail World."
      />

      <div className="relative min-h-[calc(100vh-4.5rem)] py-12 px-4 sm:px-6 flex flex-col justify-center items-center overflow-hidden">
        {/* Subtle decorative nail & floral background accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-40 dark:opacity-20"
        >
          <div className="absolute top-10 left-1/4 size-96 rounded-full bg-gradient-to-br from-lavender/40 to-blush/30 blur-3xl" />
          <div className="absolute bottom-10 right-1/4 size-96 rounded-full bg-gradient-to-tl from-champagne/40 to-lavender/30 blur-3xl" />
        </div>

        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Create Your Account
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
              Choose the account type that matches how you use Nail World.
            </p>
          </div>

          {/* Account Type Selector (Tabs) */}
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-border/80 bg-muted/40 p-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setAccountType("personal");
                setErrorMessage("");
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-medium transition-all ${
                accountType === "personal"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="size-4" />
              <span>Personal Account</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountType("brand");
                setErrorMessage("");
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-medium transition-all ${
                accountType === "brand"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="size-4" />
              <span>Brand Studio (10-Day Trial)</span>
            </button>
          </div>

          {/* Registration Card */}
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Notice */}
            {successNotice && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* PERSONAL ACCOUNT FORM */}
            {accountType === "personal" && (
              <form onSubmit={handlePersonalSubmit} className="space-y-4">
                {/* Benefits Banner */}
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs text-muted-foreground space-y-1.5">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    Personal Account Benefits
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                    <li>Save your millimeter nail measurements across sessions.</li>
                    <li>Easily match against every partner brand chart in one click.</li>
                    <li>
                      <strong>Guest measurement is always free:</strong> You don't need an account to measure right now.
                    </li>
                  </ul>
                </div>

                <div>
                  <label
                    htmlFor="reg-personal-name"
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                  >
                    Full Name
                  </label>
                  <input
                    id="reg-personal-name"
                    type="text"
                    value={personalName}
                    onChange={(e) => setPersonalName(e.target.value)}
                    placeholder="e.g. Pooja Verma"
                    required
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-personal-email"
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="reg-personal-email"
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="pooja@example.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="reg-personal-password"
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="reg-personal-password"
                        type={showPassword ? "text" : "password"}
                        value={personalPassword}
                        onChange={(e) => setPersonalPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 pr-9 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-personal-confirm"
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                    >
                      Confirm Password
                    </label>
                    <input
                      id="reg-personal-confirm"
                      type={showPassword ? "text" : "password"}
                      value={personalConfirmPassword}
                      onChange={(e) => setPersonalConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    id="reg-personal-terms"
                    type="checkbox"
                    checked={personalAgreeTerms}
                    onChange={(e) => setPersonalAgreeTerms(e.target.checked)}
                    required
                    className="mt-0.5 size-4 rounded border-border text-foreground accent-foreground cursor-pointer"
                  />
                  <label
                    htmlFor="reg-personal-terms"
                    className="text-xs text-muted-foreground leading-snug cursor-pointer select-none"
                  >
                    I agree to the Terms of Service & Privacy Policy.
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full justify-center py-2.5 text-sm font-semibold mt-2"
                >
                  {isSubmitting ? "Creating Account..." : "Create Personal Account"}
                </Button>
              </form>
            )}

            {/* BRAND ACCOUNT FORM */}
            {accountType === "brand" && (
              <form onSubmit={handleBrandSubmit} className="space-y-4">
                {/* 10-Day Free Trial Callout */}
                <div className="rounded-xl border border-border/80 bg-muted/40 p-4 text-xs text-foreground space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Clock className="size-4 text-foreground" />
                      10-Day Free Trial Included
                    </span>
                    <span className="rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5">
                      No Payment Required
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Instantly set up your press-on sizing chart and test how customers match with your sizes. Your 10-day trial starts immediately upon registration.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="reg-brand-name"
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                    >
                      Brand / Studio Name
                    </label>
                    <input
                      id="reg-brand-name"
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Velvet Claws Studio"
                      required
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-contact-name"
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                    >
                      Contact Person Name
                    </label>
                    <input
                      id="reg-contact-name"
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. Aarav Roy"
                      required
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-business-email"
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                  >
                    Business Email
                  </label>
                  <input
                    id="reg-business-email"
                    type="email"
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    placeholder="partner@yourstudio.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="reg-website"
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                    >
                      Website (Optional if Instagram provided)
                    </label>
                    <input
                      id="reg-website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourbrand.com"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-instagram"
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                    >
                      Instagram Handle
                    </label>
                    <input
                      id="reg-instagram"
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="@yourbrand_nails"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-location"
                    className="block text-xs font-semibold text-muted-foreground mb-1"
                  >
                    City / Country
                  </label>
                  <input
                    id="reg-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Mumbai, India"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="reg-brand-password"
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="reg-brand-password"
                        type={showPassword ? "text" : "password"}
                        value={brandPassword}
                        onChange={(e) => setBrandPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 pr-9 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-brand-confirm"
                      className="block text-xs font-semibold text-muted-foreground mb-1"
                    >
                      Confirm Password
                    </label>
                    <input
                      id="reg-brand-confirm"
                      type={showPassword ? "text" : "password"}
                      value={brandConfirmPassword}
                      onChange={(e) => setBrandConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    id="reg-brand-terms"
                    type="checkbox"
                    checked={brandAgreeTerms}
                    onChange={(e) => setBrandAgreeTerms(e.target.checked)}
                    required
                    className="mt-0.5 size-4 rounded border-border text-foreground accent-foreground cursor-pointer"
                  />
                  <label
                    htmlFor="reg-brand-terms"
                    className="text-xs text-muted-foreground leading-snug cursor-pointer select-none"
                  >
                    I agree to the Studio Partner Terms and Privacy Policy.
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full justify-center py-2.5 text-sm font-semibold mt-2"
                >
                  {isSubmitting ? "Starting 10-Day Trial..." : "Start 10-Day Free Brand Trial"}
                </Button>
              </form>
            )}

            {/* Subtle note & sign in link */}
            <div className="mt-5 pt-5 border-t border-border/60 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-foreground hover:underline">
                Sign In
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
              <span>Measure nails now without an account</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default RegisterPage;
