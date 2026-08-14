import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronRight, Mail, Phone, MapPin, Edit2, Calendar, IndianRupee, BookOpen, ShoppingBag, Repeat2, Truck, ArrowLeftRight } from "lucide-react";
import { apiRequest, safeParseJson } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageSkeleton from "../components/ui/PageSkeleton";
import EmptyState from "../components/ui/EmptyState";
import DataTable from "../components/ui/DataTable";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import SubscriptionForm from "../components/subscription/SubscriptionForm";
import OrderForm from "../components/order/OrderForm";
import CustomerForm from "../components/customer/CustomerForm";
import PageError from "../components/ui/PageError";
import toast from "react-hot-toast";

function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2) || "?").toUpperCase();
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("ledger");
  const [passbook, setPassbook] = useState({ user: {}, entries: [] });
  const [passbookLoading, setPassbookLoading] = useState(false);

  const [modalType, setModalType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);
  const [areas, setAreas] = useState([]);
  const [deliveryConfig, setDeliveryConfig] = useState({ assignedArea: "", deliverySequence: "" });

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/user/admin/${id}`);
      if (res.status === 401) return;
      if (!res.ok) {
        const p = await safeParseJson(res);
        throw new Error(p?.message || "Failed to load customer");
      }
      const payload = await res.json();
      setCustomer(payload);
      const u = payload.user || payload;
      setDeliveryConfig({
        assignedArea: u.assignedArea?._id || u.assignedArea || "",
        deliverySequence: u.deliverySequence ?? "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchPassbook = useCallback(async () => {
    setPassbookLoading(true);
    try {
      const res = await apiRequest(`/api/payments/${id}`);
      if (!res.ok) throw new Error("Failed to fetch passbook");
      setPassbook(await res.json());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPassbookLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);
  useEffect(() => { if (tab === "ledger") fetchPassbook(); }, [tab, fetchPassbook]);

  useEffect(() => {
    apiRequest("/api/areas")
      .then((r) => r.json())
      .then((data) => setAreas(data.areas || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (modalType === "subscription" || modalType === "order") {
      apiRequest("/api/products")
        .then((r) => r.json())
        .then((data) => setProducts(data.products || data || []))
        .catch(() => toast.error("Failed to load products"));
    }
  }, [modalType]);

  if (loading) return <PageSkeleton />;
  if (error) return <PageError message={error} onRetry={fetchCustomer} />;
  if (!customer) return <EmptyState text="Customer not found." />;

  const user = customer.user || customer;
  const orders = customer.recentOrders || [];
  const subscriptions = customer.subscriptions || [];
  const totalDeliveries = subscriptions.reduce((s, sub) => s + (sub.deliveryHistory?.length || 0), 0);
  const areaName = areas.find((a) => a._id === deliveryConfig.assignedArea)?.name || null;

  async function saveDeliveryConfigFor(userId, dc) {
    const res = await apiRequest(`/api/user/admin/${userId}/delivery-config`, {
      method: "PUT",
      body: JSON.stringify({
        assignedArea: dc?.assignedArea || null,
        deliverySequence: dc?.deliverySequence !== "" && dc?.deliverySequence != null ? Number(dc.deliverySequence) : null,
      }),
    });
    const data = await safeParseJson(res);
    if (!res.ok) throw new Error(data?.message || "Failed to save delivery config.");
    return data;
  }

  function openEditCustomer() {
    setForm({
      ...user,
      address: user.addresses?.[0] || { street: "", city: "", state: "", pincode: "" },
      password: "",
      deliveryConfig: { ...deliveryConfig },
    });
    setModalType("customer");
  }

  function openAddSubscription() {
    setForm({
      userId: id, productId: "", quantityPerDay: 1, deliverySchedule: "daily",
      customDays: [], startDate: new Date().toISOString().split("T")[0],
    });
    setModalType("subscription");
  }

  function openAddPayment() {
    setForm({
      userId: id, amount: "", transactionId: "", notes: "",
      date: new Date().toISOString().split("T")[0],
    });
    setModalType("payment");
  }

  function openAddAdjustment() {
    setForm({
      userId: id, adjType: "credit_adjustment", amount: "", notes: "",
      date: new Date().toISOString().split("T")[0],
    });
    setModalType("adjustment");
  }

  async function handleSave(e) {
    if (e) e.preventDefault();

    if (modalType === "adjustment") {
      const parsedAmt = parseFloat(form?.amount);
      if (isNaN(parsedAmt) || parsedAmt <= 0) {
        toast.error("Enter a valid positive amount.");
        return;
      }
    }

    setSaving(true);
    try {
      let endpoint, method;
      if (modalType === "subscription")  { endpoint = "/api/subscriptions/admin/create"; method = "POST"; }
      else if (modalType === "order")    { endpoint = "/api/order/admin/create";          method = "POST"; }
      else if (modalType === "customer") { endpoint = `/api/user/admin/${id}`;            method = "PUT"; }
      else if (modalType === "payment")  { endpoint = "/api/payments/admin/record";       method = "POST"; }
      else if (modalType === "adjustment") { endpoint = "/api/payments/admin/record";     method = "POST"; }

      const body =
        modalType === "customer"
          ? { ...form, addresses: form.address.street ? [form.address] : [] }
          : modalType === "adjustment"
          ? { userId: form.userId, type: form.adjType, amount: parseFloat(form.amount), notes: form.notes, date: form.date }
          : form;

      const res = await apiRequest(endpoint, { method, body: JSON.stringify(body) });
      const payload = await safeParseJson(res);
      if (!res.ok) throw new Error(payload?.message || `Failed to save ${modalType}`);

      if (modalType === "customer" && form?.deliveryConfig) {
        try {
          await saveDeliveryConfigFor(id, form.deliveryConfig);
        } catch (err) {
          toast.error(`Customer saved, but delivery config failed: ${err.message}`);
        }
      }

      toast.success(`${modalType.charAt(0).toUpperCase() + modalType.slice(1)} saved!`);
      setModalType(null);
      fetchCustomer();
      if (modalType === "payment" || modalType === "adjustment") fetchPassbook();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  /* ─── Modal content ─────────────────────────── */
  const modalTitle =
    modalType === "customer"    ? "Edit Customer" :
    modalType === "subscription"? "Add Subscription" :
    modalType === "order"       ? "Add Order" :
    modalType === "adjustment"  ? "Add Account Adjustment" :
                                  "Collect Payment";

  const modalContent = (() => {
    if (modalType === "customer")
      return (
        <CustomerForm
          form={form}
          onChange={(updates) => setForm((f) => ({ ...f, ...updates }))}
          onSubmit={handleSave}
          saving={saving}
          areas={areas}
          deliveryConfig={form?.deliveryConfig}
        />
      );
    if (modalType === "subscription")
      return (
        <SubscriptionForm
          form={form}
          onChange={(updates) => setForm((f) => ({ ...f, ...updates }))}
          products={products}
          customers={[user]}
          onSubmit={handleSave}
          saving={saving}
        />
      );
    if (modalType === "order")
      return (
        <OrderForm
          form={form}
          onChange={(updates) => setForm((f) => ({ ...f, ...updates }))}
          products={products}
          customers={[user]}
          onSubmit={handleSave}
          saving={saving}
        />
      );
    if (modalType === "payment")
      return (
        <div className="payment-form">
          {user.accountBalance > 0 && (
            <div className="payment-balance-banner">
              <div>
                <span className="payment-balance-label">Outstanding balance</span>
                <span className="payment-balance-amount">{formatCurrency(user.accountBalance)}</span>
              </div>
              <button
                type="button"
                className="payment-fill-btn"
                onClick={() => setForm({ ...form, amount: user.accountBalance })}
              >
                Fill
              </button>
            </div>
          )}
          <div className="payment-amount-wrap">
            <span className="payment-currency">₹</span>
            <input
              type="number"
              className="payment-amount-input"
              value={form?.amount || ""}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              min="0"
              step="0.01"
              autoFocus
            />
          </div>
          {form?.amount > 0 && (
            <div className="payment-amount-preview">
              <span className="payment-amount-preview-label">Collecting</span>
              <span className="payment-amount-preview-value">{formatCurrency(form.amount)}</span>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={form?.date || ""}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Reference</label>
              <input
                type="text"
                value={form?.transactionId || ""}
                onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
                placeholder="UPI ref, cheque no."
              />
            </div>
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              value={form?.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any notes about this payment"
              rows={2}
            />
          </div>
        </div>
      );
    if (modalType === "adjustment")
      return (
        <div className="payment-form">
          {/* Type toggle */}
          <div className="adj-type-toggle">
            <button
              type="button"
              className={`adj-type-btn${form?.adjType === "credit_adjustment" ? " active" : ""}`}
              onClick={() => setForm((f) => ({ ...f, adjType: "credit_adjustment" }))}
            >
              Credit — Add Money
            </button>
            <button
              type="button"
              className={`adj-type-btn adj-type-btn--debit${form?.adjType === "debit_adjustment" ? " active" : ""}`}
              onClick={() => setForm((f) => ({ ...f, adjType: "debit_adjustment" }))}
            >
              Debit — Add Charge
            </button>
          </div>
          <p className="adj-type-hint">
            {form?.adjType === "credit_adjustment"
              ? "Reduces the customer's balance — use for refunds, goodwill credits, or corrections."
              : "Increases the customer's balance — use for missed charges or corrections."}
          </p>

          {/* Amount */}
          <div className="payment-amount-wrap">
            <span className="payment-currency">₹</span>
            <input
              type="number"
              className="payment-amount-input"
              value={form?.amount || ""}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              min="0"
              step="0.01"
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={form?.date || ""}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              value={form?.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional details"
              rows={2}
            />
          </div>
        </div>
      );
    return null;
  })();

  const saveLabel =
    saving ? "Saving…" :
    modalType === "payment"    ? "Record Payment" :
    modalType === "adjustment" ? "Save Adjustment" :
    `Save ${modalType || ""}`;

  /* ─── Tab data ──────────────────────────────── */
  const tabs = [
    { key: "ledger",        label: "Ledger",        icon: BookOpen,   count: passbook.entries?.length },
    { key: "orders",        label: "Orders",        icon: ShoppingBag, count: orders.length },
    { key: "subscriptions", label: "Subscriptions", icon: Repeat2,    count: subscriptions.length },
  ];

  /* ─── Order columns ─────────────────────────── */
  const orderColumns = [
    { key: "_id",         label: "Order ID",  render: (r) => <code>#{r._id?.slice(-8)}</code> },
    { key: "totalAmount", label: "Amount",    render: (r) => formatCurrency(r.totalAmount) },
    { key: "orderStatus", label: "Status",    render: (r) => <StatusTag value={r.orderStatus} /> },
    { key: "createdAt",   label: "Date",      render: (r) => formatDate(r.createdAt) },
  ];

  const renderOrderCard = (order) => (
    <div className="customer-sub-card">
      <div className="customer-sub-card-main">
        <div className="customer-sub-card-name">Order <code>#{order._id?.slice(-6).toUpperCase()}</code></div>
        <div className="customer-sub-card-meta">{formatDate(order.createdAt)}</div>
      </div>
      <div className="customer-sub-card-right">
        <StatusTag value={order.orderStatus} />
        <div className="customer-sub-card-value">{formatCurrency(order.totalAmount)}</div>
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
    <div className="customer-sub-card">
      <div className="customer-sub-card-main">
        <div className="customer-sub-card-name">{sub.productId?.name || "Product"}</div>
        <div className="customer-sub-card-meta">
          {sub.quantityPerDay} {sub.productId?.unit || "unit"}/day · {sub.deliverySchedule}
        </div>
      </div>
      <div className="customer-sub-card-right">
        <StatusTag value={sub.status} />
        <div className="customer-sub-card-value">{formatCurrency(sub.totalPricePerDay)}/day</div>
      </div>
    </div>
  );

  return (
    <div className="customer-detail-page view-stack">
      {/* Breadcrumb */}
      <nav className="customer-page-breadcrumb" aria-label="Breadcrumb">
        <Link to="/customers">Customers</Link>
        <ChevronRight size={14} />
        <span className="text-primary">{user.name}</span>
      </nav>

      {/* Hero profile panel */}
      <div className="customer-hero">
        {/* Identity row — always side-by-side */}
        <div className="customer-hero-top">
          <div className={`customer-hero-avatar role-${user.role}`} aria-hidden="true">
            {getInitials(user.name)}
          </div>
          <div className="customer-hero-identity">
            <div className="customer-hero-name-row">
              <span className="customer-hero-name">{user.name}</span>
              {!user.isActive && <StatusTag value="inactive" />}
            </div>
            <div className="customer-hero-contact">
              {user.phone && (
                <span className="customer-hero-contact-item">
                  <Phone size={14} />{user.phone}
                </span>
              )}
              {user.email && (
                <span className="customer-hero-contact-item">
                  <Mail size={14} />{user.email}
                </span>
              )}
            </div>
          </div>
          {user.accountBalance > 0 && (
            <span className="customer-hero-due-badge">{formatCurrency(user.accountBalance)} due</span>
          )}
        </div>

        {/* Meta: ID + since */}
        <div className="customer-hero-meta">
          <span className="customer-id-pill">#{user._id?.slice(-6).toUpperCase()}</span>
          <span className="customer-since">
            <Calendar size={11} />
            Since {formatDate(user.createdAt)}
          </span>
          <button
            type="button"
            className="customer-hero-delivery-chip"
            onClick={openEditCustomer}
            title="Change delivery configuration"
          >
            <Truck size={11} />
            {areaName
              ? `${areaName}${deliveryConfig.deliverySequence !== "" && deliveryConfig.deliverySequence != null ? ` · Seq ${deliveryConfig.deliverySequence}` : ""}`
              : deliveryConfig.assignedArea
              ? "Delivery configured"
              : "Delivery not configured"}
          </button>
        </div>

        {/* Addresses */}
        {user.addresses?.length > 0 && (
          <div className="customer-hero-address">
            <div className="customer-hero-address-list">
              {user.addresses.map((addr, i) => (
                <span key={i} className="customer-hero-addr-chip">
                  <MapPin size={10} />
                  {addr.street}, {addr.city} — {addr.pincode}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="customer-hero-actions">
          <button className="btn btn-secondary btn-sm" onClick={openEditCustomer}>
            <Edit2 size={14} /> Edit
          </button>
          <button className="btn btn-secondary btn-sm" onClick={openAddSubscription}>
            <Repeat2 size={14} /> Subscribe
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAddPayment}>
            <IndianRupee size={14} /> Collect
          </button>
          <button className="btn btn-secondary btn-sm" onClick={openAddAdjustment}>
            <ArrowLeftRight size={14} /> Adjust
          </button>
        </div>
      </div>

      {/* Metric strip */}
      <div className="customer-metrics">
        <div className={`customer-metric-card ${user.accountBalance > 0 ? "metric-danger" : "metric-success"}`}>
          <div className="customer-metric-header">
            <span className="customer-metric-icon" aria-hidden="true"><IndianRupee size={11} /></span>
            <span className="customer-metric-label">Balance Due</span>
          </div>
          <span className="customer-metric-value">{formatCurrency(user.accountBalance)}</span>
        </div>
        <div className="customer-metric-card metric-info">
          <div className="customer-metric-header">
            <span className="customer-metric-icon" aria-hidden="true"><Repeat2 size={11} /></span>
            <span className="customer-metric-label">Deliveries</span>
          </div>
          <span className="customer-metric-value">{totalDeliveries}</span>
        </div>
        <div className="customer-metric-card metric-neutral">
          <div className="customer-metric-header">
            <span className="customer-metric-icon" aria-hidden="true"><ShoppingBag size={11} /></span>
            <span className="customer-metric-label">Orders</span>
          </div>
          <span className="customer-metric-value">{orders.length}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="customer-tabs-panel">
        <div className="customer-tabs-header" role="tablist">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={`customer-tab-btn ${tab === key ? "active" : ""}`}
              onClick={() => setTab(key)}
            >
              <Icon size={16} />
              {label}
              {count > 0 && <span className="customer-tab-count">{count}</span>}
            </button>
          ))}
        </div>

        <div className="customer-tab-body" role="tabpanel">
          {tab === "ledger" && (
            <DataTable
              columns={[
                { key: "date",        label: "Date",        render: (r) => formatDate(r.date) },
                { key: "description", label: "Description", render: (r) => (
                  <div>
                    <div className="cell-title">{r.description}</div>
                    {r.notes && <div className="cell-sub">{r.notes}</div>}
                  </div>
                )},
                { key: "debit",  label: "Debit",  render: (r) => r.type === "debit"  ? <span className="danger-text">-{formatCurrency(r.amount)}</span> : "—" },
                { key: "credit", label: "Credit", render: (r) => r.type === "credit" ? <span className="success-text">+{formatCurrency(r.amount)}</span> : "—" },
              ]}
              data={passbook.entries}
              renderCard={(r) => (
                <div className="ledger-entry-card">
                  <div className={`ledger-type-dot ${r.type}`} aria-hidden="true" />
                  <div className="ledger-entry-body">
                    <div className="ledger-entry-desc">{r.description}</div>
                    <div className="ledger-entry-note">
                      {r.notes && <span>{r.notes} · </span>}
                      {formatDate(r.date)}
                    </div>
                  </div>
                  <span className={`ledger-entry-amount ${r.type}`}>
                    {r.type === "debit" ? "−" : "+"}{formatCurrency(r.amount)}
                  </span>
                </div>
              )}
              emptyText="No transactions yet."
              pageSize={20}
              loading={passbookLoading}
            />
          )}
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
        </div>
      </div>

      {/* Modal */}
      <ResponsiveModal
        open={!!modalType}
        onClose={() => setModalType(null)}
        title={modalTitle}
        footer={
          <div className="product-modal-footer">
            <div />
            <div className="product-modal-footer-right">
              <button className="btn btn-secondary btn-sm" onClick={() => setModalType(null)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saveLabel}
              </button>
            </div>
          </div>
        }
      >
        {modalContent}
      </ResponsiveModal>
    </div>
  );
}
