import { Link } from "react-router-dom";
import { siteConfig } from "@/data/siteConfig";
import { brandConfig } from "@/config/branding";

import { NailWorldLogo } from "@/components/common/NailWorldLogo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card text-foreground">
      <div className="section-shell grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        {/* Universal Platform Intro */}
        <div>
          <div className="mb-3">
            <NailWorldLogo variant="horizontal" height={38} />
          </div>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {brandConfig.productDescriptor}
          </p>
          <p className="mt-1 text-xs italic text-foreground/80 font-medium">
            "{brandConfig.tagline}"
          </p>
          <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
            {brandConfig.summary}
          </p>

          {/* TechHelp Solutions Attribution & Platform Support */}
          <div className="mt-4 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <span>{brandConfig.attribution}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Support:{" "}
              <a
                href={`mailto:${brandConfig.supportEmail}`}
                className="text-foreground hover:underline font-medium"
              >
                {brandConfig.supportEmail}
              </a>
            </p>
          </div>
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
              Brand Partner Portal
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

      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground space-y-1">
        <p>
          © 2026 {brandConfig.brandName}. Sizing charts are specifications of respective studios and brands. Measurements are optical millimeter approximations.
        </p>
        <p className="text-[11px] text-muted-foreground/80 font-medium">
          {brandConfig.attribution}
        </p>
      </div>
    </footer>
  );
}
