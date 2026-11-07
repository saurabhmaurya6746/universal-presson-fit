import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import type { UserRole } from "@/services/authService";
import { RefreshCw } from "lucide-react";
import { getBrandPortalPath } from "@/services/authService";

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

/**
 * RouteGuard
 *
 * Client-side route protection component.
 * - Shows a graceful loading spinner while session resolution is in flight.
 * - Redirects unauthenticated visitors to `/login` with location memory.
 * - Redirects users lacking required role permissions to their appropriate home dashboard.
 */
export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const { user, isLoading } = useAuthUser();
  const location = useLocation();
  const { brandId } = useParams<{ brandId: string }>();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-24 text-center">
        <RefreshCw className="size-8 animate-spin text-lavender-deep mb-3" />
        <p className="text-xs font-medium text-muted-foreground">Verifying secure access...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // If user has a valid session but is attempting to access an unauthorized route,
    // redirect them to their role-appropriate dashboard:
    if (user.role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    if (user.role === "brand") {
      return <Navigate to={getBrandPortalPath(user.brandId)} replace />;
    }
    return <Navigate to="/account" replace />;
  }

  if (brandId && user.role === "brand" && brandId !== user.brandId) {
    return <Navigate to={getBrandPortalPath(user.brandId)} replace />;
  }

  return <>{children}</>;
}
