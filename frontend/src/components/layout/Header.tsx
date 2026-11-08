import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { authAdapter } from "@/services/authAdapter";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getBrandPortalPath } from "@/services/authService";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { cn } from "@/utils/cn";

export const navLinks = [
  { label: "Home", to: "/" },
  { label: "Brands", to: "/brands" },
  { label: "How It Works", to: "/how-sizing-works" },
  { label: "Pricing", to: "/pricing" },
  { label: "For Brands", to: "/login" },
] as const;

export function isLinkActive(linkTo: string, currentPath: string): boolean {
  if (linkTo === "/") {
    return currentPath === "/";
  }
  if (linkTo === "/ai-nail-size-finder" || linkTo === "/ai-size-finder") {
    return (
      currentPath === "/ai-nail-size-finder" ||
      currentPath === "/ai-size-finder" ||
      currentPath.startsWith("/ai-nail-size-finder/") ||
      currentPath.startsWith("/ai-size-finder/")
    );
  }
  return currentPath === linkTo || currentPath.startsWith(`${linkTo}/`);
}

import { NailWorldLogo } from "@/components/common/NailWorldLogo";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="Nail World Home"
      className="group flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-95"
    >
      {/* On small mobile screens, show the crisp vector icon emblem; on tablet/desktop, show the full horizontal logo */}
      <div className="block sm:hidden">
        <NailWorldLogo variant="icon" height={38} width={38} className="rounded-full shadow-sm" />
      </div>
      <div className="hidden sm:block">
        <NailWorldLogo variant="horizontal" height={compact ? 38 : 44} />
      </div>
    </Link>
  );
}

export function Header() {
  const location = useLocation();
  const [studioOpen, setStudioOpen] = useState(false);
  const { user: currentUser } = useAuthUser();

  const handleMobileLogout = async () => {
    await authAdapter.logout();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between px-5 sm:px-8 gap-4">
        {/* Brand */}
        <div className="flex shrink-0 items-center">
          <Brand compact />
        </div>

        {/* Desktop Navigation */}
        <nav
          aria-label="Main navigation"
          className="hidden items-center justify-center gap-6 md:flex text-sm"
        >
          {navLinks.map(({ label, to }) => {
            const active = isLinkActive(to, location.pathname);

            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "py-1 text-sm font-medium tracking-normal transition-colors",
                  active
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action & Account Menu */}
        <div className="flex items-center gap-3">
          <Button
            asChild
            size="sm"
            className="hidden sm:inline-flex h-9 px-4 text-xs font-semibold"
          >
            <Link to="/ai-nail-size-finder">Measure My Nails</Link>
          </Button>

          {/* Account Dropdown (or Sign In link for guests) */}
          <AccountMenu />

          {/* Mobile Navigation Drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                aria-label="Open navigation"
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 text-foreground"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[85vw] max-w-sm border-border bg-background p-6 flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Nail World platform menu
                </SheetDescription>
                <Brand />

                {/* Mobile Logged-in User Profile Summary */}
                {currentUser && (
                  <div className="mt-6 rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
                        {currentUser.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-foreground">
                          {currentUser.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {currentUser.email}
                        </p>
                        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase">
                          {currentUser.role}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/60 flex flex-col gap-1 text-xs">
                      {currentUser.role === "personal" && (
                        <SheetClose asChild>
                          <Link
                            to="/account"
                            className="py-1.5 font-medium text-foreground hover:underline"
                          >
                            My Profile & Saved Scans
                          </Link>
                        </SheetClose>
                      )}
                      {currentUser.role === "brand" && (
                        <>
                          <SheetClose asChild>
                            <Link
                              to={getBrandPortalPath(currentUser.brandId)}
                              className="py-1.5 font-medium text-foreground hover:underline"
                            >
                              Brand Studio Dashboard
                            </Link>
                          </SheetClose>
                          <SheetClose asChild>
                            <Link
                              to={getBrandPortalPath(currentUser.brandId, "charts")}
                              className="py-1.5 font-medium text-foreground hover:underline"
                            >
                              Manage Sizing Chart
                            </Link>
                          </SheetClose>
                          <SheetClose asChild>
                            <Link
                              to={getBrandPortalPath(currentUser.brandId, "settings")}
                              className="py-1.5 font-medium text-foreground hover:underline"
                            >
                              Studio Settings
                            </Link>
                          </SheetClose>
                        </>
                      )}
                      {currentUser.role === "admin" && (
                        <SheetClose asChild>
                          <Link
                            to="/admin"
                            className="py-1.5 font-medium text-foreground hover:underline"
                          >
                            Platform Admin Workspace
                          </Link>
                        </SheetClose>
                      )}
                      <button
                        type="button"
                        onClick={handleMobileLogout}
                        className="py-1.5 text-left text-xs font-semibold text-destructive hover:underline mt-1"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}

                {/* Primary Mobile Links */}
                <nav className="mt-6 flex flex-col space-y-1" aria-label="Platform mobile navigation">
                  {navLinks.map(({ label, to }) => {
                    const active = isLinkActive(to, location.pathname);
                    return (
                      <SheetClose asChild key={to}>
                        <Link
                          to={to}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "rounded-lg px-3 py-2.5 text-base font-medium transition-colors",
                            active
                              ? "bg-accent text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                          )}
                        >
                          {label}
                        </Link>
                      </SheetClose>
                    );
                  })}
                  {!currentUser && (
                    <SheetClose asChild>
                      <Link
                        to="/login"
                        className="rounded-lg px-3 py-2.5 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40"
                      >
                        Sign In
                      </Link>
                    </SheetClose>
                  )}
                </nav>

                {/* Collapsed Secondary Group: Partner Studio */}
                <div className="mt-8 pt-6 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setStudioOpen(!studioOpen)}
                    className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground py-1"
                  >
                    <span>Partner Studio: Aura Nails</span>
                    {studioOpen ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </button>

                  {studioOpen && (
                    <div className="mt-3 grid grid-cols-2 gap-1.5 pl-1 text-xs">
                      <SheetClose asChild>
                        <Link
                          to="/studio/aura-nails"
                          className="py-1.5 text-muted-foreground hover:text-foreground"
                        >
                          Studio Home
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Link
                          to="/services"
                          className="py-1.5 text-muted-foreground hover:text-foreground"
                        >
                          Services
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Link
                          to="/gallery"
                          className="py-1.5 text-muted-foreground hover:text-foreground"
                        >
                          Gallery
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Link
                          to="/booking"
                          className="py-1.5 text-muted-foreground hover:text-foreground"
                        >
                          Booking
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Link
                          to="/faq"
                          className="py-1.5 text-muted-foreground hover:text-foreground"
                        >
                          FAQ
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Link
                          to="/contact"
                          className="py-1.5 text-muted-foreground hover:text-foreground"
                        >
                          Contact
                        </Link>
                      </SheetClose>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6">
                <SheetClose asChild>
                  <Button asChild className="w-full text-xs font-semibold">
                    <Link to="/ai-nail-size-finder">Measure My Nails</Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
