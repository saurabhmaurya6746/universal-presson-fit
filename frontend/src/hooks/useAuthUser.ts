import { useEffect, useState } from "react";
import { authAdapter } from "@/services/authAdapter";
import { getCurrentUser as getDemoCurrentUser } from "@/services/authService";
import type { AuthUser } from "@/services/authService";

export function useAuthUser() {
  const remoteAuthEnabled = authAdapter.isRemoteEnabled();
  const [user, setUser] = useState<AuthUser | null>(() =>
    remoteAuthEnabled ? null : getDemoCurrentUser()
  );
  const [isLoading, setIsLoading] = useState(remoteAuthEnabled);

  useEffect(() => {
    let isMounted = true;

    const refreshUser = async () => {
      if (!authAdapter.isRemoteEnabled()) {
        if (isMounted) {
          setUser(getDemoCurrentUser());
          setIsLoading(false);
        }
        return;
      }

      const currentUser = await authAdapter.getCurrentUser();
      if (isMounted) {
        setUser(currentUser);
        setIsLoading(false);
      }
    };

    void refreshUser();

    const handleAuthChange = () => void refreshUser();
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("pressonfit_auth_change", handleAuthChange);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("pressonfit_auth_change", handleAuthChange);
    };
  }, [remoteAuthEnabled]);

  return { user, isLoading };
}
