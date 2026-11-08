import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Table,
  UploadCloud,
  Building2,
  Settings,
  Eye,
  ExternalLink,
} from "lucide-react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { cn } from "@/utils/cn";
import { SEO } from "@/components/common/SEO";
import { getBrandPortalPath } from "@/services/authService";

interface BrandPortalLayoutProps {
  brandName?: string;
  contactName?: string;
  status?: string;
  brandSlug?: string;
  children: React.ReactNode;
}

export function BrandPortalLayout({
  brandName,
  contactName,
  status = "active",
  brandSlug,
  children,
}: BrandPortalLayoutProps) {
  const location = useLocation();
  const { user } = useAuthUser();

  const activeBrandName = brandName || user?.brandName || "Brand Studio";
  const activeContact = contactName || user?.name || "Studio Owner";
  const isPending = status === "pending_review";
  const dashboardPath = getBrandPortalPath(user?.brandId);
  const chartsPath = getBrandPortalPath(user?.brandId, "charts");
  const settingsPath = getBrandPortalPath(user?.brandId, "settings");

  const navigation = [
    {
      name: "Overview",
      href: dashboardPath,
      icon: LayoutDashboard,
      active: location.pathname === dashboardPath,
    },
    {
      name: "Size Charts",
      href: chartsPath,
      icon: Table,
      active: location.pathname === chartsPath,
    },
    {
      name: "Create / Upload Chart",
      href: `${chartsPath}?action=new`,
      icon: UploadCloud,
      active: false,
    },
    {
      name: "Studio Profile",
      href: `${settingsPath}#profile`,
      icon: Building2,
      active: location.pathname === settingsPath && location.hash.includes("profile"),
    },
    {
      name: "Settings & Plan",
      href: settingsPath,
      icon: Settings,
      active: location.pathname === settingsPath && !location.hash.includes("profile"),
    },
  ];

  return (
    <>
      <SEO
        title={`${activeBrandName} | Brand Portal | Nail World`}
        description="Nail World Partner Sizing and Brand Management Portal."
      />

      <div className="min-h-[calc(100vh-4.5rem)] bg-muted/20">
        {/* Top Header Bar for Studio Context */}
        <div className="border-b border-border/80 bg-card shadow-2xs">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold tracking-widest text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-md">
                    Brand Portal
                  </span>
                  {isPending ? (
                    <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2.5 py-0.5">
                      Under Review
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-0.5">
                      Verified Studio
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
                  Welcome, {activeBrandName}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Studio Contact: <span className="font-semibold text-foreground">{activeContact}</span> • {user?.email}
                </p>
              </div>

              {/* Public Profile View Shortcut if active */}
              {status === "active" && brandSlug ? (
                <Link
                  to={`/brands/${brandSlug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors shadow-2xs"
                >
                  <Eye className="size-3.5" />
                  Public Profile
                  <ExternalLink className="size-3 text-muted-foreground" />
                </Link>
              ) : null}
            </div>

            {/* Mobile Navigation Tabs */}
            <div className="mt-5 flex overflow-x-auto gap-2 border-t border-border/60 pt-3 md:hidden">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0",
                    item.active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Layout with Sidebar */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {/* Sidebar Navigation (Desktop) */}
            <aside className="hidden md:block md:col-span-1 space-y-6">
              <nav aria-label="Brand Portal Navigation" className="space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all",
                        item.active
                          ? "bg-card text-foreground border border-border/80 shadow-2xs"
                          : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          item.active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Studio Quick Info Card */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Building2 className="size-4 text-primary" />
                  <span>Studio Details</span>
                </div>
                <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
                  <p>
                    <strong className="text-foreground">Brand:</strong> {activeBrandName}
                  </p>
                  <p>
                    <strong className="text-foreground">Status:</strong>{" "}
                    <span className="capitalize">{status.replace("_", " ")}</span>
                  </p>
                  <p>
                    <strong className="text-foreground">Portal:</strong> Dedicated Brand Portal
                  </p>
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <main className="md:col-span-3 lg:col-span-4 space-y-6 min-w-0">
              {children}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

export default BrandPortalLayout;
