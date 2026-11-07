import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * BrandLoginPage:
 * Previously a duplicate login form. Now smoothly redirects to the unified
 * shared /login route with ?type=brand parameter as requested.
 */
export function BrandLoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/login?type=brand", { replace: true });
  }, [navigate]);

  return null;
}

export default BrandLoginPage;
