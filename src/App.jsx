import { useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { usePortalData } from "./context/PortalDataContext";
import { apiRequest } from "./api/client";

import Sidebar from "./components/layout/Sidebar";
import MobileHeader from "./components/layout/MobileHeader";
import Topbar from "./components/layout/Topbar";
import BottomNav from "./components/layout/BottomNav";
import MobileDrawer from "./components/layout/MobileDrawer";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AdminRoute from "./components/layout/AdminRoute";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import PageSkeleton from "./components/ui/PageSkeleton";
import { useMediaQuery } from "./hooks/useMediaQuery";

// Lazy-loaded pages
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DeliveriesPage = lazy(() => import("./pages/DeliveriesPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"));
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage"));
const SubscriptionDetailPage = lazy(() => import("./pages/SubscriptionDetailPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const CustomerDetailPage = lazy(() => import("./pages/CustomerDetailPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const BalancesPage = lazy(() => import("./pages/BalancesPage"));
const AreasPage = lazy(() => import("./pages/AreasPage"));
const HolidaysPage = lazy(() => import("./pages/HolidaysPage"));
const ManifestsPage = lazy(() => import("./pages/ManifestsPage"));
const ManifestDetailPage = lazy(() => import("./pages/ManifestDetailPage"));
const AgentDashboardPage = lazy(() => import("./pages/AgentDashboardPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const AgentDetailPage = lazy(() => import("./pages/AgentDetailPage"));
const ComplaintsPage = lazy(() => import("./pages/ComplaintsPage"));
const ReturnsPage = lazy(() => import("./pages/ReturnsPage"));
const ContactMessagesPage = lazy(() => import("./pages/ContactMessagesPage"));
const SuppliersPage = lazy(() => import("./pages/SuppliersPage"));
const SupplierDetailPage = lazy(() => import("./pages/SupplierDetailPage"));
const MilkCollectionsPage = lazy(() => import("./pages/MilkCollectionsPage"));

import "./styles/layout.css";
import "./styles/components.css";
import "./styles/tables.css";
import "./styles/forms.css";
import "./styles/pages/dashboard.css";
import "./styles/pages/deliveries.css";
import "./styles/pages/products.css";
import "./styles/pages/manifests.css";
import "./styles/pages/invoices.css";
import "./styles/pages/areas.css";
import "./styles/pages/support.css";
import "./styles/pages/suppliers.css";

function App() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data: portalData, loading: portalLoading, lastUpdatedAt, refreshData } = usePortalData();
  const [collapsed, setCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  async function handleOrderStatusUpdate(orderId, status) {
    try {
      const response = await apiRequest(`/api/order/admin/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to update order.");
      toast.success(`Order status updated to ${status}`);
      await refreshData(true);
    } catch (error) {
      console.error("Order update error:", error);
      toast.error(error.message || "Failed to update order");
    }
  }

  async function handleSubscriptionStatusUpdate(subscriptionId, status) {
    try {
      const response = await apiRequest(`/api/subscriptions/admin/${subscriptionId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to update subscription.");
      toast.success(`Subscription status updated to ${status}`);
      await refreshData(true);
    } catch (error) {
      console.error("Subscription update error:", error);
      toast.error(error.message || "Failed to update subscription");
    }
  }

  return (
    <ErrorBoundary>
      <Toaster
        position={isMobile ? "top-center" : "top-right"}
        toastOptions={{
          duration: 3000,
          style: {
            background: "#fffdf9",
            color: "#1a2e22",
            border: "1px solid #ddd3c4",
            boxShadow: "0 8px 24px rgba(30, 46, 34, 0.12)",
          },
          success: {
            iconTheme: { primary: "#386641", secondary: "#fff" },
          },
          error: {
            iconTheme: { primary: "#dc2626", secondary: "#fff" },
          },
        }}
      />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoute />}>
            <Route
              path="*"
              element={
                <div className="admin-shell">
                  <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
                  <MobileHeader
                    lastUpdatedAt={lastUpdatedAt}
                    onRefresh={() => refreshData(true)}
                    loading={portalLoading}
                  />
                  <div className="main-area">
                    <Topbar
                      lastUpdatedAt={lastUpdatedAt}
                      onRefresh={() => refreshData(true)}
                      loading={portalLoading}
                    />
                    <main className="page-content">
                      <Routes>
                        <Route element={<AdminRoute />}>
                          <Route
                            index
                            element={
                              <DashboardPage
                                data={portalData}
                                loading={portalLoading}
                                onRefresh={() => refreshData(true)}
                                onOrderUpdate={handleOrderStatusUpdate}
                                onSubscriptionUpdate={handleSubscriptionStatusUpdate}
                              />
                            }
                          />
                          <Route
                            path="orders"
                            element={
                              <OrdersPage
                                orders={portalData?.orders || []}
                                onUpdate={handleOrderStatusUpdate}
                                onRefresh={() => refreshData(true)}
                              />
                            }
                          />
                          <Route path="orders/:id" element={<OrderDetailPage />} />
                          <Route
                            path="subscriptions"
                            element={
                              <SubscriptionsPage
                                subscriptions={portalData?.subscriptions || []}
                                onUpdate={handleSubscriptionStatusUpdate}
                                onRefresh={() => refreshData(true)}
                              />
                            }
                          />
                          <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
                          <Route 
                            path="customers" 
                            element={
                              <CustomersPage 
                                onRefresh={() => refreshData(true)} 
                              />
                            } 
                          />
                          <Route path="customers/:id" element={<CustomerDetailPage />} />
                          <Route path="products" element={<ProductsPage />} />
                          <Route path="invoices" element={<BalancesPage />} />
                          <Route path="areas" element={<AreasPage />} />
                          <Route path="agents" element={<AgentsPage />} />
                          <Route path="agents/:id" element={<AgentDetailPage />} />
                          <Route path="complaints" element={<ComplaintsPage />} />
                          <Route path="returns" element={<ReturnsPage />} />
                          <Route path="holidays" element={<HolidaysPage />} />
                          <Route path="messages" element={<ContactMessagesPage />} />
                          <Route path="manifests" element={<ManifestsPage />} />
                          <Route path="manifests/:id" element={<ManifestDetailPage />} />
                          <Route path="suppliers" element={<SuppliersPage />} />
                          <Route path="suppliers/:id" element={<SupplierDetailPage />} />
                          <Route path="milk-collections" element={<MilkCollectionsPage />} />
                        </Route>
                        <Route path="deliveries" element={<DeliveriesPage />} />
                        <Route path="agent" element={<AgentDashboardPage />} />
                        <Route path="agent/manifest/:id" element={<ManifestDetailPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </main>
                    <footer className="portal-footer">
                      <div className="footer-inner">
                        <div className="footer-left">
                          <span className="footer-brand">Farmilky</span>
                          <span className="footer-tagline">Fresh dairy, delivered daily.</span>
                        </div>
                        <div className="footer-links">
                          <span>Privacy</span>
                          <span>Terms</span>
                          <span>Support</span>
                        </div>
                        <span className="footer-copy">&copy; {new Date().getFullYear()} Farmilky</span>
                      </div>
                    </footer>
                  </div>
                  <BottomNav onMoreClick={() => setIsDrawerOpen(true)} />
                  <MobileDrawer 
                    isOpen={isDrawerOpen} 
                    onClose={() => setIsDrawerOpen(false)} 
                  />

                </div>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;