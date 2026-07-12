import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { apiRequest, safeParseJson } from "../api/client";
import { useAuth } from "./AuthContext";

const PortalDataContext = createContext(null);

export function PortalDataProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const isStale = useCallback(() => {
    if (!lastUpdatedAt) return true;
    return new Date() - lastUpdatedAt > 60000;
  }, [lastUpdatedAt]);

  const refreshData = useCallback(async (force = false) => {
    if (!user) return;
    if (!force && !isStale() && data) return;

    if (force) {
      window.dispatchEvent(new CustomEvent("portal:refresh"));
    }

    setLoading(true);
    try {
      const deliveryBoardResponse = await apiRequest("/api/subscriptions/admin/delivery-board");
      if (deliveryBoardResponse.status === 401) {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
        return;
      }
      if (!deliveryBoardResponse.ok) {
        const errorPayload = await safeParseJson(deliveryBoardResponse);
        throw new Error(errorPayload?.message || "Failed to load delivery board.");
      }
      const deliveryBoardPayload = await deliveryBoardResponse.json();
      let ordersPayload = { orders: [] };
      let subscriptionsPayload = { subscriptions: [] };
      let supplyPayload = { summary: { byProduct: [] }, supplies: [] };

      if (isAdmin) {
        const [ordersResponse, subscriptionsResponse, supplyResponse] = await Promise.all([
          apiRequest("/api/order/admin/all"),
          apiRequest("/api/subscriptions/admin/all"),
          apiRequest("/api/subscriptions/admin/today-supply"),
        ]);
        if ([ordersResponse, subscriptionsResponse, supplyResponse].some((r) => r.status === 401)) {
          window.dispatchEvent(new CustomEvent("auth:unauthorized"));
          return;
        }
        if (!ordersResponse.ok || !subscriptionsResponse.ok || !supplyResponse.ok) {
          const failing = [ordersResponse, subscriptionsResponse, supplyResponse].find((r) => !r.ok);
          const errorPayload = await safeParseJson(failing);
          throw new Error(errorPayload?.message || "Failed to load admin data.");
        }
        [ordersPayload, subscriptionsPayload, supplyPayload] = await Promise.all([
          ordersResponse.json(),
          subscriptionsResponse.json(),
          supplyResponse.json(),
        ]);
      }

      setData({
        orders: ordersPayload.orders || [],
        subscriptions: subscriptionsPayload.subscriptions || [],
        supply: supplyPayload || { summary: { byProduct: [] }, supplies: [] },
        deliveryBoard: deliveryBoardPayload || { summary: {}, deliveries: [] },
      });
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error("Portal data load error:", error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, isStale, data]);

  useEffect(() => {
    if (user) refreshData();
  }, [user, refreshData]);

  return (
    <PortalDataContext.Provider value={{ data, loading, lastUpdatedAt, refreshData }}>
      {children}
    </PortalDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePortalData() {
  const ctx = useContext(PortalDataContext);
  if (!ctx) throw new Error("usePortalData must be used within PortalDataProvider");
  return ctx;
}