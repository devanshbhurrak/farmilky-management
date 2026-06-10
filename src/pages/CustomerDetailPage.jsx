import { ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiRequest, safeParseJson } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageHeader from "../components/ui/PageHeader";
import PageSkeleton from "../components/ui/PageSkeleton";
import EmptyState from "../components/ui/EmptyState";
import DataTable from "../components/ui/DataTable";
import { useMediaQuery } from "../hooks/useMediaQuery";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("orders");

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/user/admin/${id}`);
      if (res.status === 401) return;
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed to load customer"); }
      const data = await res.json();
      setCustomer(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

  if (loading) return <PageSkeleton />;
  if (error) return <EmptyState text={error} action={{ label: "Retry", onClick: fetchCustomer }} />;
  if (!customer) return <EmptyState text="Customer not found." />;

  const user = customer.user || customer;
  const orders = customer.recentOrders || [];
  const subscriptions = customer.subscriptions || [];
  const invoices = customer.invoices || [];

  const orderColumns = [
    { key: "_id", label: "Order ID", render: (r) => <code>#{r._id?.slice(-8)}</code> },
    { key: "totalAmount", label: "Amount", render: (r) => formatCurrency(r.totalAmount) },
    { key: "orderStatus", label: "Status", render: (r) => <StatusTag value={r.orderStatus} /> },
    { key: "createdAt", label: "Date", render: (r) => formatDate(r.createdAt) },
  ];

  const renderOrderCard = (order) => (
    <div className="sub-table-card">
      <div className="st-card-header">
        <code>#{order._id?.slice(-8)}</code>
        <StatusTag value={order.orderStatus} />
      </div>
      <div className="st-card-body">
        <strong>{formatCurrency(order.totalAmount)}</strong>
        <span>{formatDate(order.createdAt)}</span>
      </div>
    </div>
  );

  const subColumns = [
    { key: "productId.name", label: "Product" },
    { key: "quantityPerDay", label: "Qty/Day" },
    { key: "totalPricePerDay", label: "Daily Value", render: (r) => formatCurrency(r.totalPricePerDay) },
    { key: "status", label: "Status", render: (r) => <StatusTag value={r.status} /> },
  ];

  const renderSubCard = (sub) => (
    <div className="sub-table-card">
      <div className="st-card-header">
        <strong>{sub.productId?.name || "Product"}</strong>
        <StatusTag value={sub.status} />
      </div>
      <div className="st-card-body">
        <span>{sub.quantityPerDay} per day</span>
        <strong>{formatCurrency(sub.totalPricePerDay)}</strong>
      </div>
    </div>
  );

  const invoiceColumns = [
    { key: "_id", label: "Invoice", render: (r) => <code>#{r._id?.slice(-8)}</code> },
    { key: "month", label: "Month" },
    { key: "totalAmount", label: "Amount", render: (r) => formatCurrency(r.totalAmount) },
    { key: "amountPaid", label: "Paid", render: (r) => formatCurrency(r.amountPaid) },
    { key: "status", label: "Status", render: (r) => <StatusTag value={r.status} /> },
  ];

  const renderInvoiceCard = (inv) => (
    <div className="sub-table-card">
      <div className="st-card-header">
        <strong>{inv.month}</strong>
        <StatusTag value={inv.status} />
      </div>
      <div className="st-card-body">
        <span>Paid: {formatCurrency(inv.amountPaid)}</span>
        <strong>Total: {formatCurrency(inv.totalAmount)}</strong>
      </div>
    </div>
  );

  return (
    <div className="view-stack">
      <PageHeader 
        title={user.name}
        subtitle={`${user.email} · ${user.phone || "No phone"}`}
        breadcrumb={[
          { label: "Customers", path: "/customers" },
          { label: user.name }
        ]}
        actions={<StatusTag value={user.role} />}
      />

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: "var(--space-1)" }}>Customer Since</p>
            <strong>{formatDate(user.createdAt)}</strong>
          </div>
          <span className="info-chip" style={{ background: "var(--surface-muted)", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-pill)", fontSize: "var(--font-size-xs)", fontWeight: "bold" }}>
            ID: #{user._id?.slice(-6).toUpperCase()}
          </span>
        </div>
        
        {user.addresses?.length > 0 && (
          <div className="customer-addresses" style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--border-soft)" }}>
            <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Saved Addresses</p>
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              {user.addresses.map((addr, i) => (
                <div key={i} className="list-card" style={{ background: "var(--surface-muted)", boxShadow: "none" }}>
                  <div>
                    <strong>{addr.type}</strong>
                    <span>{addr.street}, {addr.city}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "var(--font-size-sm)", color: "var(--text-muted)" }}>
                    {addr.state} - {addr.pincode}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={isMobile ? "mobile-metric-strip" : "card-grid"}>
        <div className="panel info-card">
          <p className="eyebrow">Total Spend</p>
          <strong>{formatCurrency((customer.totalOrderSpend || 0) + (customer.totalSubscriptionSpend || 0))}</strong>
        </div>
        <div className="panel info-card">
          <p className="eyebrow">Pending</p>
          <strong>{formatCurrency(customer.pendingAmount || 0)}</strong>
        </div>
        <div className="panel info-card">
          <p className="eyebrow">Invoices</p>
          <strong>{invoices.length}</strong>
        </div>
      </div>

      <section className="panel detail-tabs-panel">
        <div className="scrollable-tab-bar">
          {["orders", "subscriptions", "invoices"].map((t) => (
            <button
              key={t}
              className={tab === t ? "tab-pill active" : "tab-pill"}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="tab-content" style={{ marginTop: "1.5rem" }}>
          {tab === "orders" && (
            <DataTable 
              columns={orderColumns} 
              data={orders} 
              renderCard={renderOrderCard} 
              emptyText="No orders yet." 
              pageSize={10} 
              onRowClick={(row) => navigate(`/orders/${row._id}`)}
            />
          )}
          {tab === "subscriptions" && (
            <DataTable 
              columns={subColumns} 
              data={subscriptions} 
              renderCard={renderSubCard}
              emptyText="No subscriptions yet." 
              pageSize={10} 
              onRowClick={(row) => navigate(`/subscriptions/${row._id}`)}
            />
          )}
          {tab === "invoices" && (
            <DataTable 
              columns={invoiceColumns} 
              data={invoices} 
              renderCard={renderInvoiceCard}
              emptyText="No invoices yet." 
              pageSize={10} 
            />
          )}
        </div>
      </section>
    </div>
  );
}
