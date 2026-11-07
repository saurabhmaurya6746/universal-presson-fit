import { Navigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getBrandPortalPath, type BrandPortalSection } from "@/services/authService";

export function BrandPortalRedirect({ section }: { section: BrandPortalSection }) {
  const { user, isLoading } = useAuthUser();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "brand") {
    return <Navigate to={getBrandPortalPath(user.brandId, section)} replace />;
  }
  return <Navigate to={user.role === "admin" ? "/admin" : "/account"} replace />;
}
