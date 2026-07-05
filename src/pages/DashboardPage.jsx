import { useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, ShoppingCart, Repeat, Truck, AlertCircle, Users, ArrowRight } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";

const fetchPerformance = createApiFetch("/api/admin/delivery-performance");
import { formatCurrency, formatDate, formatTime } from "../utils/format";
import InfoCard from "../components/ui/InfoCard";
import StatusTag from "../components/ui/StatusTag";
import EmptyState from "../components/ui/EmptyState";
import LoadingScreen from "../components/ui/LoadingScreen";
import MetricChip from "../components/ui/MetricChip";
import { useMediaQuery } from "../hooks/useMediaQuery";

function buildOverview(data) {
  const deliveryBoard = data?.deliveryBoard || {};
  const orders = data?.orders || [];
  const subscriptions = data?.subscriptions || [];
  const supplySummary = data?.supply?.summary || {};

  return {
    revenue: orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
    pendingCodOrders: orders.filter(
      (order) => order.paymentMethod === "COD" && order.paymentStatus === "pending"
    ).length,
    todaysOrders: orders.filter(
      (o) => new Date(o.createdAt).toDateString() === new Date().toDateString()
    ).length,
    activeSubscriptions: subscriptions.filter((item) => item.status === "active").length,
    pendingDeliveries: deliveryBoard?.summary?.remainingDeliveries || 0,
    totalCustomers: new Set([
      ...orders.map((o) => o.userId?._id?.toString()),
      ...subscriptions.map((s) => s.userId?._id?.toString()),
    ].filter(Boolean)).size,
    supplyValue: supplySummary.totalAmount || 0,
    topProducts: supplySummary.byProduct || [],
    pausedSubscriptions: subscriptions.filter((item) => item.status === "paused").length,
    cancelledSubscriptions: subscriptions.filter((item) => item.status === "cancelled").length,
    pendingSubscriptionAmount: subscriptions.reduce((sum, item) => sum + (item.pendingAmount || 0), 0),
  };
}

export default function DashboardPage({ data, loading, onOrderUpdate, onSubscriptionUpdate }) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const overview = useMemo(() => buildOverview(data), [data]);
  const { data: perfData } = useApiData(fetchPerformance);

  const recentOrders = useMemo(() => {
    return (data?.orders || [])
      .filter((o) => o.orderStatus !== "cancelled")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [data?.orders]);

  const recentSubscriptions = useMemo(() => {
    return (data?.subscriptions || [])
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 5);
  }, [data?.subscriptions]);

  if (loading && (!data || (Object.keys(data).length === 0))) {
    return <LoadingScreen text="Loading dashboard data..." />;
  }

  if (!data || (Object.keys(data).length === 0)) {
    return <EmptyState text="No dashboard data available." />;
  }

  return (
    <div className="view-stack">
      <header className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Dashboard</h1>
          <p className="page-header-subtitle">Welcome back! Here's what's happening today.</p>
        </div>
      </header>

      <div className="card-grid">
        <InfoCard title="Revenue Booked" value={formatCurrency(overview.revenue)} icon={TrendingUp} to="/orders" />
        <InfoCard title="Today's Orders" value={overview.todaysOrders} icon={ShoppingCart} to="/orders" />
        <InfoCard title="Active Subscriptions" value={overview.activeSubscriptions} icon={Repeat} to="/subscriptions" />
        <InfoCard title="Pending Deliveries" value={overview.pendingDeliveries} icon={Truck} color="warning" to="/deliveries" />
        <InfoCard title="Pending COD" value={overview.pendingCodOrders} icon={AlertCircle} color="danger" to="/orders" />
        <InfoCard title="Total Customers" value={overview.totalCustomers} icon={Users} color="info" to="/customers" />
      </div>

      <div className="two-column-grid">
        <section className="panel">
          <p className="eyebrow">Load Sheet</p>
          <div className="stack-list">
            {overview.topProducts.length === 0 ? (
              <EmptyState text="No supply is due today." />
            ) : (
              overview.topProducts.map((item) => (
                <div className="list-card" key={item.productId}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.customerCount} customer stops</span>
                  </div>
                  <div className="card-figure" style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: "var(--font-size-lg)" }}>
                      {item.totalQuantity} {item.unit}
                    </strong>
                    <span style={{ color: "var(--color-primary-dark)", fontWeight: "bold" }}>
                      {formatCurrency(item.totalAmount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Watchlist</p>
          <div className="stack-list">
            <Link to="/subscriptions" className="list-card nav-link">
              <div>
                <strong>Paused subscriptions</strong>
                <span>Customers temporarily off route</span>
              </div>
              <div className="card-figure">
                <strong style={{ fontSize: "var(--font-size-xl)" }}>{overview.pausedSubscriptions}</strong>
              </div>
            </Link>
            <Link to="/subscriptions" className="list-card nav-link">
              <div>
                <strong>Cancelled subscriptions</strong>
                <span>Churn you may want to review</span>
              </div>
              <div className="card-figure">
                <strong style={{ fontSize: "var(--font-size-xl)" }}>{overview.cancelledSubscriptions}</strong>
              </div>
            </Link>
            <Link to="/invoices" className="list-card nav-link">
              <div>
                <strong>Pending subscription amount</strong>
                <span>Open postpaid balance</span>
              </div>
              <div className="card-figure">
                <strong style={{ fontSize: "var(--font-size-xl)", color: "var(--danger)" }}>
                  {formatCurrency(overview.pendingSubscriptionAmount)}
                </strong>
              </div>
            </Link>
          </div>
        </section>
      </div>

      <div className="two-column-grid">
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
            <p className="eyebrow" style={{ marginBottom: 0 }}>Recent Orders</p>
            <Link to="/orders" className="btn btn-secondary btn-sm">View all</Link>
          </div>
          <div className="stack-list">
            {recentOrders.length === 0 ? (
              <EmptyState text="No recent orders." />
            ) : (
              recentOrders.map((order) => (
                <Link to={`/orders/${order._id}`} className="list-card nav-link" key={order._id}>
                  <div>
                    <strong>{order.userId?.name || "Unknown"}</strong>
                    <span>{formatCurrency(order.totalAmount)} • {formatTime(order.createdAt)}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <StatusTag value={order.orderStatus} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
            <p className="eyebrow" style={{ marginBottom: 0 }}>Subscription Changes</p>
            <Link to="/subscriptions" className="btn btn-secondary btn-sm">View all</Link>
          </div>
          <div className="stack-list">
            {recentSubscriptions.length === 0 ? (
              <EmptyState text="No recent subscription changes." />
            ) : (
              recentSubscriptions.map((sub) => (
                <Link to={`/subscriptions/${sub._id}`} className="list-card nav-link" key={sub._id}>
                  <div>
                    <strong>{sub.userId?.name || "Unknown"}</strong>
                    <span>{sub.productId?.name || "Product"} • {formatDate(sub.updatedAt || sub.createdAt)}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <StatusTag value={sub.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>


      {perfData && (perfData.agentStats?.length > 0 || perfData.areaStats?.length > 0) && (
        <div className="two-column-grid">
          {perfData.agentStats?.length > 0 && (
            <section className="panel">
              <p className="eyebrow">Agent Performance (Last {perfData.days}d)</p>
              <div className="stack-list">
                {perfData.agentStats.map((a) => (
                  <div className="list-card" key={a._id}>
                    <div>
                      <strong>{a.agentName || "Unknown Agent"}</strong>
                      <span>{a.delivered}/{a.totalEntries} delivered - {a.manifestCount} runs</span>
                    </div>
                    <div className="card-figure">
                      <strong className={a.successRate >= 80 ? "rate-good" : a.successRate >= 50 ? "rate-mid" : "rate-poor"}>
                        {Math.round(a.successRate)}%
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {perfData.areaStats?.length > 0 && (
            <section className="panel">
              <p className="eyebrow">Area Performance (Last {perfData.days}d)</p>
              <div className="stack-list">
                {perfData.areaStats.map((a) => (
                  <div className="list-card" key={a._id}>
                    <div>
                      <strong>{a.areaName || "Unknown Area"}</strong>
                      <span>{a.delivered}/{a.totalEntries} delivered</span>
                    </div>
                    <div className="card-figure">
                      <strong className={a.successRate >= 80 ? "rate-good" : a.successRate >= 50 ? "rate-mid" : "rate-poor"}>
                        {Math.round(a.successRate)}%
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
              {(perfData.openComplaints > 0 || perfData.pendingReturns > 0) && (
                <div className="panel-divider" style={{ display: "flex", gap: "1.5rem" }}>
                  {perfData.openComplaints > 0 && (
                    <Link to="/complaints" className="rate-mid" style={{ fontSize: "0.875rem", textDecoration: "none" }}>
                      {perfData.openComplaints} open complaint{perfData.openComplaints > 1 ? "s" : ""}
                    </Link>
                  )}
                  {perfData.pendingReturns > 0 && (
                    <Link to="/returns" className="rate-poor" style={{ fontSize: "0.875rem", textDecoration: "none" }}>
                      {perfData.pendingReturns} pending return{perfData.pendingReturns > 1 ? "s" : ""}
                    </Link>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
