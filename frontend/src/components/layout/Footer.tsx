import { Link } from "react-router-dom";
import { siteConfig } from "@/data/siteConfig";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card text-foreground">
      <div className="section-shell grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        {/* Universal Platform Intro */}
        <div>
          <span className="font-display text-xl font-bold tracking-wide">
            PRESSON FIT
          </span>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Universal Sizing Platform
          </p>
          <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
            Estimate natural fingernail widths in millimeters using a ₹10 reference coin. Compare with sizing charts from different press-on studios.
          </p>
        </div>

        {/* Universal Platform Links */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Platform
          </p>
          <nav className="flex flex-col space-y-2 text-xs sm:text-sm text-muted-foreground">
            <Link to="/ai-nail-size-finder" className="hover:text-foreground transition-colors">
              Measure My Nails
            </Link>
            <Link to="/brands" className="hover:text-foreground transition-colors">
              Brands Directory
            </Link>
            <Link to="/how-sizing-works" className="hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link to="/ai-nail-size-finder" className="hover:text-foreground transition-colors">
              Nail Sizing
            </Link>
            <Link to="/brand/login" className="hover:text-foreground transition-colors">
              For Brands · Demo
            </Link>
          </nav>
        </div>

        {/* Partner Studio: Aura Nails Group */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Partner Studio: Aura Nails
          </p>
          <nav className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <Link to="/studio/aura-nails" className="hover:text-foreground font-medium transition-colors">
              Studio Home
            </Link>
            <Link to="/about" className="hover:text-foreground transition-colors">
              About Studio
            </Link>
            <Link to="/services" className="hover:text-foreground transition-colors">
              Services
            </Link>
            <Link to="/gallery" className="hover:text-foreground transition-colors">
              Nail Art Gallery
            </Link>
            <Link to="/booking" className="hover:text-foreground transition-colors">
              Book Appointment
            </Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">
              FAQ & Care
            </Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">
              Contact Studio
            </Link>
          </nav>

          <p className="mt-4 text-[11px] text-muted-foreground">
            Studio Inquiries:{" "}
            <a href={`mailto:${siteConfig.email}`} className="text-foreground hover:underline">
              {siteConfig.email}
            </a>
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © 2026 PressOn Fit Platform. Sizing charts are specifications of respective studios and brands. Measurements are optical millimeter approximations.
      </div>
    </footer>
  );
}
