import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Building2,
  ShieldCheck,
  Ruler,
  Table,
  Eye,
  LogOut,
  ChevronDown,
  Layers,
  Settings,
  Sparkles,
  Clock,
} from "lucide-react";
import { authAdapter } from "@/services/authAdapter";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getBrandPortalPath } from "@/services/authService";

export function AccountMenu() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthUser();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!currentUser) {
    return (
      <Link
        to="/login"
        className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
      >
        Sign In
      </Link>
    );
  }

  const handleLogout = async () => {
    await authAdapter.logout();
    setIsOpen(false);
    navigate("/login");
  };

  // Compute 2-letter initials
  const initials = currentUser.name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "PF";

  const roleLabel =
    currentUser.role === "admin"
      ? "Platform Admin"
      : currentUser.role === "brand"
      ? "Studio Partner"
      : "Personal Account";

  const displayName =
    currentUser.role === "brand"
      ? currentUser.brandName || currentUser.name
      : currentUser.name;

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Avatar Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-border/80 bg-card p-1 pr-2.5 text-xs font-medium text-foreground hover:border-foreground/30 hover:bg-muted/40 transition-all focus:outline-none focus:ring-2 focus:ring-foreground/20 cursor-pointer shadow-xs"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-[11px] font-bold tracking-tight">
          {initials}
        </span>
        <span className="inline-block max-w-[120px] sm:max-w-[160px] truncate font-semibold text-xs text-foreground">
          {displayName}
        </span>
        <ChevronDown
          className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-border bg-card p-2 text-foreground shadow-soft z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* User Profile Header */}
          <div className="flex items-start gap-3 p-2.5 pb-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-bold text-xs">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground">
                {displayName}
              </p>
              {currentUser.role === "brand" && currentUser.brandName && (
                <p className="truncate text-[10px] text-muted-foreground">
                  Contact: {currentUser.name}
                </p>
              )}
              <p className="truncate text-[11px] text-muted-foreground">
                {currentUser.email}
              </p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {currentUser.role === "admin" && (
                  <ShieldCheck className="size-3 text-amber-600 dark:text-amber-400" />
                )}
                {currentUser.role === "brand" && (
                  <Building2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                )}
                {currentUser.role === "personal" && (
                  <User className="size-3 text-foreground" />
                )}
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="my-1 border-t border-border/60" />

          {/* Role-Specific Navigation Links */}
          <div className="space-y-0.5 py-1 text-xs">
            {/* PERSONAL USER MENU */}
            {currentUser.role === "personal" && (
              <>
                <Link
                  to="/account"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <User className="size-4 text-muted-foreground" />
                  <span>My Profile</span>
                </Link>
                <Link
                  to="/account#history"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Profile & Scan History</span>
                </Link>
                <Link
                  to="/ai-nail-size-finder"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Ruler className="size-4 text-muted-foreground" />
                  <span>Measure My Nails</span>
                </Link>
                <Link
                  to="/account/settings"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Settings className="size-4 text-muted-foreground" />
                  <span>Settings & Preferences</span>
                </Link>
              </>
            )}

            {/* BRAND USER MENU */}
            {currentUser.role === "brand" && (
              <>
                <Link
                  to={getBrandPortalPath(currentUser.brandId)}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Building2 className="size-4 text-muted-foreground" />
                  <span>Brand Dashboard</span>
                </Link>
                <Link
                  to={getBrandPortalPath(currentUser.brandId, "charts")}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Table className="size-4 text-muted-foreground" />
                  <span>Manage Sizing Chart</span>
                </Link>
                <Link
                  to={`/brands/${currentUser.brandId || "aura-luxury"}`}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Eye className="size-4 text-muted-foreground" />
                  <span>Public Brand Profile</span>
                </Link>
                <Link
                  to={`${getBrandPortalPath(currentUser.brandId, "settings")}#plan`}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Sparkles className="size-4 text-muted-foreground" />
                  <span>Plan & Trial</span>
                </Link>
                <Link
                  to={getBrandPortalPath(currentUser.brandId, "settings")}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Settings className="size-4 text-muted-foreground" />
                  <span>Studio Settings</span>
                </Link>
              </>
            )}

            {/* ADMIN USER MENU */}
            {currentUser.role === "admin" && (
              <>
                <Link
                  to="/admin"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold">Platform Admin Workspace</span>
                </Link>
                <Link
                  to="/admin/settings"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Settings className="size-4 text-muted-foreground" />
                  <span>Admin Settings & Reset</span>
                </Link>
                <Link
                  to="/brand/brand-aura-luxury/dashboard"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Layers className="size-4 text-muted-foreground" />
                  <span>Preview as Brand (Demo)</span>
                </Link>
              </>
            )}
          </div>

          <div className="my-1 border-t border-border/60" />

          {/* Sign Out Button */}
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <LogOut className="size-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
