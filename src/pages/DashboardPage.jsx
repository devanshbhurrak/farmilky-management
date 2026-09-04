import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, ShoppingCart, Repeat, Truck, AlertCircle, Users,
  ArrowRight, ClipboardList, Droplets,
  Clock, MapPin, PackageCheck, FlaskConical,
} from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatDate, formatTime } from "../utils/format";
import InfoCard from "../components/ui/InfoCard";
import StatusTag from "../components/ui/StatusTag";
import EmptyState from "../components/ui/EmptyState";
import LoadingScreen from "../components/ui/LoadingScreen";
import NavIcon from "../components/icons/NavIcon";

const fetchPerformance   = createApiFetch("/api/admin/delivery-performance");
const fetchShift         = createApiFetch("/api/milk-collections/today-shift");
const fetchDeliveryStats = createApiFetch("/api/admin/delivery-stats");

function fmtQty(n) {
  if (n == null) return "—";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function buildOverview(data) {
  const deliveryBoard = data?.deliveryBoard || {};
  const orders = data?.orders || [];
  const subscriptions = data?.subscriptions || [];
  const supplySummary = data?.supply?.summary || {};

  return {
    revenue: orders
      .filter((order) => order.orderStatus !== "cancelled")
      .reduce((sum, order) => sum + (order.totalAmount || 0), 0),
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
    // Total liters scheduled for delivery today (from today's supply sheet)
    scheduledLiters: (supplySummary.byProduct || [])
      .filter((p) => (p.unit || "").toLowerCase() === "l")
      .reduce((s, p) => s + (p.totalQuantity || 0), 0),
  };
}

const sectionGroups = [
  {
    label: "Operations",
    colorClass: "dash-section-group--ops",
    sections: [
      { icon: "deliveries",    label: "Delivery Board",       to: "/deliveries",       desc: "Track & manage today's deliveries" },
      { icon: "manifests",     label: "Manifests",            to: "/manifests",         desc: "Run sheets for each route" },
      { icon: "orders",        label: "Orders",               to: "/orders",            desc: "One-time orders & COD" },
      { icon: "subscriptions", label: "Subscriptions",        to: "/subscriptions",     desc: "Recurring deliveries" },
    ],
  },
  {
    label: "Customers & Finance",
    colorClass: "dash-section-group--finance",
    sections: [
      { icon: "customers", label: "Customers",            to: "/customers", desc: "Profiles and order history" },
      { icon: "invoices",  label: "Outstanding Balances", to: "/invoices",  desc: "Open postpaid dues" },
    ],
  },
  {
    label: "Products & Supply",
    colorClass: "dash-section-group--supply",
    sections: [
      { icon: "products",     label: "Products",          to: "/products",          desc: "Catalogue and pricing" },
      { icon: "suppliers",    label: "Suppliers",         to: "/suppliers",         desc: "Supplier accounts" },
      { icon: "collections",  label: "Milk Collections",  to: "/milk-collections",  desc: "Raw milk intake records" },
    ],
  },
  {
    label: "Team & Locations",
    colorClass: "dash-section-group--team",
    sections: [
      { icon: "agents",   label: "Agents",    to: "/agents",   desc: "Staff and performance" },
      { icon: "areas",    label: "Areas",     to: "/areas",    desc: "Zones and routing" },
      { icon: "holidays", label: "Holidays",  to: "/holidays", desc: "Delivery calendar" },
    ],
  },
  {
    label: "Support",
    colorClass: "dash-section-group--support",
    sections: [
      { icon: "complaints", label: "Complaints",        to: "/complaints", desc: "Complaints and resolutions" },
      { icon: "returns",    label: "Returns",           to: "/returns",    desc: "Product returns & refunds" },
      { icon: "messages",   label: "Contact Messages",  to: "/messages",   desc: "Inbound customer messages" },
    ],
  },
];

// ── Delivery & Milk Collection Summary ──────────────────────────────────────

function SummaryPanel({ todayDelivery, scheduledLiters, shiftData, deliveryStats }) {
  const [tab, setTab] = useState("today");

  const currentSession = new Date().getHours() < 13 ? "morning" : "evening";

  // Confirmed actual qty only — matches totalLiters on the collection page
  const todayMilkQty =
    (shiftData?.morning?.qty || 0) + (shiftData?.evening?.qty || 0);

  const todayMilkConfirmed =
    (shiftData?.morning?.confirmed || 0) + (shiftData?.evening?.confirmed || 0);
  const todayMilkTotal =
    (shiftData?.morning?.total || 0) + (shiftData?.evening?.total || 0);

  const monthDeliveredQty = deliveryStats?.monthly?.deliveredQty;
  const monthMilkQty      = deliveryStats?.monthly?.milkQty;

  const deliveryPct =
    todayDelivery.total > 0
      ? Math.round((todayDelivery.completed / todayDelivery.total) * 100)
      : 0;

  return (
    <section className="panel dash-panel dash-summary-panel">
      {/* Header */}
      <div className="dash-summary-header">
        <div className="dash-summary-title-row">
          <span className="dash-panel-heading">
            <PackageCheck size={16} strokeWidth={2} />
            Today&apos;s Operations
          </span>
          <div className="dash-summary-tabs">
            <button
              className={`dash-summary-tab${tab === "today" ? " dash-summary-tab--active" : ""}`}
              onClick={() => setTab("today")}
            >
              Today
            </button>
            <button
              className={`dash-summary-tab${tab === "month" ? " dash-summary-tab--active" : ""}`}
              onClick={() => setTab("month")}
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="dash-summary-cards">
        {/* ── Deliveries card ── */}
        <Link to="/deliveries" className="dash-ops-card dash-ops-card--delivery">
          <div className="dash-ops-card-icon">
            <Truck size={18} strokeWidth={2} />
          </div>
          <div className="dash-ops-card-body">
            <span className="dash-ops-card-label">Qty Delivered</span>
            <strong className="dash-ops-card-value">
              {tab === "today"
                ? <>{fmtQty(todayDelivery.qty)} <small>L</small></>
                : monthDeliveredQty != null
                  ? <>{fmtQty(monthDeliveredQty)} <small>L</small></>
                  : <span className="dash-ops-card-loading">—</span>
              }
            </strong>
            {tab === "today" && scheduledLiters > 0 && (
              <span className="dash-ops-of-total">
                of {fmtQty(scheduledLiters)} L required
              </span>
            )}
            {tab === "today" && (
              <div className="dash-ops-progress-wrap">
                <div className="dash-ops-progress">
                  <div
                    className="dash-ops-progress-bar"
                    style={{ width: scheduledLiters > 0 ? `${Math.min(100, Math.round((todayDelivery.qty / scheduledLiters) * 100))}%` : `${deliveryPct}%` }}
                  />
                </div>
                <span className="dash-ops-progress-label">
                  {todayDelivery.completed}/{todayDelivery.total} confirmed · {deliveryPct}%
                </span>
              </div>
            )}
          </div>
          <ArrowRight size={13} className="dash-ops-card-arrow" />
        </Link>

        {/* ── Milk Collected card ── */}
        <Link to="/milk-collections" className="dash-ops-card dash-ops-card--milk">
          <div className="dash-ops-card-icon">
            <FlaskConical size={18} strokeWidth={2} />
          </div>
          <div className="dash-ops-card-body">
            <span className="dash-ops-card-label">Milk Collected</span>
            <strong className="dash-ops-card-value">
              {tab === "today"
                ? <>{fmtQty(todayMilkQty)} <small>L</small></>
                : monthMilkQty != null
                  ? <>{fmtQty(monthMilkQty)} <small>L</small></>
                  : <span className="dash-ops-card-loading">—</span>
              }
            </strong>
            {tab === "today" && shiftData && (
              <div className="dash-ops-progress-wrap">
                <div className="dash-ops-progress dash-ops-progress--milk">
                  <div
                    className="dash-ops-progress-bar"
                    style={{
                      width: todayMilkTotal > 0
                        ? `${Math.round((todayMilkConfirmed / todayMilkTotal) * 100)}%`
                        : "0%",
                    }}
                  />
                </div>
                <span className="dash-ops-progress-label">
                  {todayMilkConfirmed}/{todayMilkTotal} confirmed
                  {" · "}
                  <span className="dash-ops-session-tag">
                    {currentSession === "morning" ? "Morning" : "Evening"} shift
                  </span>
                </span>
              </div>
            )}
          </div>
          <ArrowRight size={13} className="dash-ops-card-arrow" />
        </Link>
      </div>
    </section>
  );
}

export default function DashboardPage({ data, loading }) {
  const { isAdmin } = useAuth();
  const overview = useMemo(() => buildOverview(data), [data]);
  const { data: perfData }      = useApiData(fetchPerformance);
  const { data: shiftData }     = useApiData(fetchShift);
  const { data: deliveryStats } = useApiData(fetchDeliveryStats, isAdmin);

  const currentSession = new Date().getHours() < 13 ? "morning" : "evening";
  const shift = shiftData?.[currentSession] || { qty: 0, amount: 0, confirmed: 0, total: 0 };

  const todayDelivery = useMemo(() => {
    const deliveries = data?.deliveryBoard?.deliveries || [];
    // Only subscription deliveries are in L (milk); order items are discrete counts
    const subDeliveries = deliveries.filter((d) => d.type === "subscription");
    const done = subDeliveries.filter((d) => d.deliveryStatus === "delivered");
    return {
      // outcome.actualQuantity = exact qty delivered (handles partial/extra correctly)
      qty: done.reduce((s, d) => s + (d.outcome?.actualQuantity ?? d.quantity ?? 0), 0),
      completed: done.length,
      total: subDeliveries.length,
    };
  }, [data?.deliveryBoard?.deliveries]);

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

  if (loading && (!data || Object.keys(data).length === 0)) {
    return <LoadingScreen text="Loading dashboard..." />;
  }

  if (!data || Object.keys(data).length === 0) {
    return <EmptyState text="No dashboard data available." />;
  }

  return (
    <div className="view-stack">
      {/* ── Key Metrics ─────────────────────────────── */}
      <div className="card-grid">
        <InfoCard title="Revenue Booked"       value={formatCurrency(overview.revenue)}  icon={TrendingUp}  to="/orders" />
        <InfoCard title="Today's Orders"        value={overview.todaysOrders}             icon={ShoppingCart} to="/orders" />
        <InfoCard title="Active Subscriptions"  value={overview.activeSubscriptions}      icon={Repeat}      to="/subscriptions" />
        <InfoCard title="Pending Deliveries"    value={overview.pendingDeliveries}        icon={Truck}       color="warning" to="/deliveries" />
        <InfoCard title="Pending COD"           value={overview.pendingCodOrders}         icon={AlertCircle} color="danger"  to="/orders" />
        <InfoCard title="Total Customers"       value={overview.totalCustomers}           icon={Users}       color="info"    to="/customers" />
      </div>

      {/* ── Delivery & Milk Collection Summary ──────── */}
      <SummaryPanel
        todayDelivery={todayDelivery}
        scheduledLiters={overview.scheduledLiters}
        shiftData={shiftData}
        deliveryStats={deliveryStats}
      />

      {/* ── Section Navigator ────────────────────────── */}
      <div className="dash-sections">
        {sectionGroups.map((group) => (
          <div className={`dash-section-group ${group.colorClass}`} key={group.label}>
            <p className="dash-section-group-label">{group.label}</p>
            <div className="dash-section-grid">
              {group.sections.map((s) => (
                <Link key={s.to} to={s.to} className="dash-section-card">
                  <div className="dash-section-card-icon">
                    <NavIcon name={s.icon} size={18} strokeWidth={1.75} />
                  </div>
                  <div className="dash-section-card-body">
                    <strong className="dash-section-card-label">{s.label}</strong>
                    <span className="dash-section-card-desc">{s.desc}</span>
                  </div>
                  <ArrowRight size={14} className="dash-section-card-arrow" strokeWidth={2} />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Load Sheet + Shift Collection ───────────── */}
      <div className="two-column-grid">
        <section className="panel dash-panel">
          <div className="panel-section-header">
            <span className="dash-panel-heading">
              <ClipboardList size={16} strokeWidth={2} />
              Load Sheet
            </span>
          </div>
          <div className="stack-list">
            {overview.topProducts.length === 0 ? (
              <EmptyState text="No supply is due today." />
            ) : (
              overview.topProducts.map((item) => (
                <div className="dash-load-item" key={item.productId}>
                  <div className="dash-load-item-left">
                    <strong className="dash-load-item-name">{item.name}</strong>
                    <span className="dash-load-item-meta">{item.customerCount} customer stops</span>
                  </div>
                  <div className="dash-load-item-right">
                    <span className="dash-load-item-qty">{item.totalQuantity} {item.unit}</span>
                    <span className="dash-load-item-amount">{formatCurrency(item.totalAmount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel dash-panel">
          <div className="panel-section-header">
            <span className="dash-panel-heading">
              <Droplets size={16} strokeWidth={2} />
              {currentSession === "morning" ? "Morning" : "Evening"} Collection
            </span>
            <Link to="/milk-collections" className="dash-view-all">
              View <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
          <div className="dash-shift-grid">
            <div className="dash-shift-stat">
              <span className="dash-shift-stat-label">Collected</span>
              <strong className="dash-shift-stat-value">{shift.qty.toFixed(1)} <small>L</small></strong>
            </div>
            <div className="dash-shift-stat">
              <span className="dash-shift-stat-label">Amount</span>
              <strong className="dash-shift-stat-value">{formatCurrency(shift.amount)}</strong>
            </div>
            <div className="dash-shift-stat">
              <span className="dash-shift-stat-label">Confirmed</span>
              <strong className="dash-shift-stat-value">{shift.confirmed}<small>/{shift.total}</small></strong>
            </div>
          </div>
        </section>
      </div>

      {/* ── Recent Activity ──────────────────────────── */}
      <div className="two-column-grid">
        <section className="panel dash-panel">
          <div className="panel-section-header">
            <span className="dash-panel-heading">
              <Clock size={16} strokeWidth={2} />
              Recent Orders
            </span>
            <Link to="/orders" className="dash-view-all">
              View all <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
          <div className="stack-list">
            {recentOrders.length === 0 ? (
              <EmptyState text="No recent orders." />
            ) : (
              recentOrders.map((order) => (
                <Link to={`/orders/${order._id}`} className="dash-feed-item" key={order._id}>
                  <div className="dash-feed-avatar">
                    {order.userId?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="dash-feed-body">
                    <strong className="dash-feed-name">{order.userId?.name || "Unknown"}</strong>
                    <span className="dash-feed-meta">{formatCurrency(order.totalAmount)} &middot; {formatTime(order.createdAt)}</span>
                  </div>
                  <StatusTag value={order.orderStatus} />
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="panel dash-panel">
          <div className="panel-section-header">
            <span className="dash-panel-heading">
              <Repeat size={16} strokeWidth={2} />
              Subscription Changes
            </span>
            <Link to="/subscriptions" className="dash-view-all">
              View all <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
          <div className="stack-list">
            {recentSubscriptions.length === 0 ? (
              <EmptyState text="No recent subscription changes." />
            ) : (
              recentSubscriptions.map((sub) => (
                <Link to={`/subscriptions/${sub._id}`} className="dash-feed-item" key={sub._id}>
                  <div className="dash-feed-avatar dash-feed-avatar--sub">
                    {sub.userId?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="dash-feed-body">
                    <strong className="dash-feed-name">{sub.userId?.name || "Unknown"}</strong>
                    <span className="dash-feed-meta">{sub.productId?.name || "Product"} &middot; {formatDate(sub.updatedAt || sub.createdAt)}</span>
                  </div>
                  <StatusTag value={sub.status} />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── Agent & Area Performance ─────────────────── */}
      {perfData && (perfData.agentStats?.length > 0 || perfData.areaStats?.length > 0) && (
        <div className="two-column-grid">
          {perfData.agentStats?.length > 0 && (
            <section className="panel dash-panel">
              <div className="panel-section-header">
                <span className="dash-panel-heading">
                  <Truck size={16} strokeWidth={2} />
                  Agent Performance (Last {perfData.days}d)
                </span>
              </div>
              <div className="stack-list">
                {perfData.agentStats.map((a) => (
                  <div className="dash-perf-item" key={a._id}>
                    <div className="dash-perf-item-left">
                      <strong>{a.agentName || "Unknown Agent"}</strong>
                      <span>{a.delivered}/{a.totalEntries} delivered &middot; {a.manifestCount} runs</span>
                    </div>
                    <div className="dash-perf-item-right">
                      <span className={`dash-perf-rate ${a.successRate >= 80 ? "dash-perf-rate--good" : a.successRate >= 50 ? "dash-perf-rate--mid" : "dash-perf-rate--poor"}`}>
                        {Math.round(a.successRate)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {perfData.areaStats?.length > 0 && (
            <section className="panel dash-panel">
              <div className="panel-section-header">
                <span className="dash-panel-heading">
                  <MapPin size={16} strokeWidth={2} />
                  Area Performance (Last {perfData.days}d)
                </span>
              </div>
              <div className="stack-list">
                {perfData.areaStats.map((a) => (
                  <div className="dash-perf-item" key={a._id}>
                    <div className="dash-perf-item-left">
                      <strong>{a.areaName || "Unknown Area"}</strong>
                      <span>{a.delivered}/{a.totalEntries} delivered</span>
                    </div>
                    <div className="dash-perf-item-right">
                      <span className={`dash-perf-rate ${a.successRate >= 80 ? "dash-perf-rate--good" : a.successRate >= 50 ? "dash-perf-rate--mid" : "dash-perf-rate--poor"}`}>
                        {Math.round(a.successRate)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {(perfData.openComplaints > 0 || perfData.pendingReturns > 0) && (
                <div className="dash-perf-alerts">
                  {perfData.openComplaints > 0 && (
                    <Link to="/complaints" className="dash-perf-alert dash-perf-alert--warning">
                      {perfData.openComplaints} open complaint{perfData.openComplaints > 1 ? "s" : ""}
                    </Link>
                  )}
                  {perfData.pendingReturns > 0 && (
                    <Link to="/returns" className="dash-perf-alert dash-perf-alert--danger">
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
