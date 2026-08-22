import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { clearApiCache } from "../hooks/useApiData";

const AuthContext = createContext(null);

const PORTAL_ROLES = ["admin", "delivery_partner", "delivery", "agent"];

function isPortalUser(user) {
  return user && PORTAL_ROLES.includes(user.role);
}

async function fetchPermissions() {
  try {
    const res = await apiRequest("/api/permissions/my");
    if (!res.ok) return [];
    const data = await res.json();
    return data.permissions ?? [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);

  const isAdmin = user?.role === "admin";
  const isDeliveryPartner = user?.role === "delivery_partner" || user?.role === "delivery" || user?.role === "agent";

  /**
   * Returns true if the current user has the given permission.
   * Admin always returns true. Permission key "*" means all-access (admin sentinel).
   */
  const hasPermission = useCallback(
    (permission) => {
      if (!permission) return true;
      if (isAdmin) return true;
      if (permissions.includes("*")) return true;
      return permissions.includes(permission);
    },
    [isAdmin, permissions]
  );

  const logout = useCallback(async () => {
    await apiRequest("/api/user/logout", { method: "POST" });
    clearApiCache();
    setUser(null);
    setPermissions([]);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const response = await apiRequest("/api/user/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Login failed.");

    const profileResponse = await apiRequest("/api/user/profile");
    const profileData = await profileResponse.json();
    const loggedInUser = profileData.user || payload.user;
    if (!isPortalUser(loggedInUser)) {
      await apiRequest("/api/user/logout", { method: "POST" });
      throw new Error("Access denied. This portal is for staff only.");
    }
    setUser(loggedInUser);
    const perms = await fetchPermissions();
    setPermissions(perms);
    return loggedInUser;
  }, []);

  useEffect(() => {
    void (async () => {
      setAuthLoading(true);
      try {
        const profileResponse = await apiRequest("/api/user/profile");
        if (!profileResponse.ok) {
          setUser(null);
          setPermissions([]);
          return;
        }
        const profileData = await profileResponse.json();
        const sessionUser = profileData.user;
        if (!isPortalUser(sessionUser)) {
          await apiRequest("/api/user/logout", { method: "POST" });
          clearApiCache();
          setUser(null);
          setPermissions([]);
          return;
        }
        setUser(sessionUser);
        const perms = await fetchPermissions();
        setPermissions(perms);
      } catch {
        setUser(null);
        setPermissions([]);
      } finally {
        setAuthLoading(false);
      }
    })();

    function onUnauthorized() {
      setUser(null);
      setPermissions([]);
    }
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  return (
    <AuthContext.Provider value={{ user, authLoading, isAdmin, isDeliveryPartner, permissions, hasPermission, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
