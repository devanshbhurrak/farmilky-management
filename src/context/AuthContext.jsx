import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const isAdmin = user?.role === "admin";
  const isDeliveryPartner = user?.role === "delivery_partner" || user?.role === "delivery";

  const logout = useCallback(async () => {
    await apiRequest("/api/user/logout", { method: "POST" });
    setUser(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await apiRequest("/api/user/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Login failed.");

    const profileResponse = await apiRequest("/api/user/profile");
    const profileData = await profileResponse.json();
    const loggedInUser = profileData.user || payload.user;
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  useEffect(() => {
    void (async () => {
      setAuthLoading(true);
      try {
        const profileResponse = await apiRequest("/api/user/profile");
        if (!profileResponse.ok) {
          setUser(null);
          return;
        }
        const profileData = await profileResponse.json();
        setUser(profileData.user);
      } catch {
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    })();

    function onUnauthorized() {
      setUser(null);
    }
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  return (
    <AuthContext.Provider value={{ user, authLoading, isAdmin, isDeliveryPartner, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
