import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronRight, Mail, Phone, MapPin, Edit2, Calendar, IndianRupee, BookOpen, ShoppingBag, Repeat2, Truck, ArrowLeftRight, QrCode, MessageCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
  const [showQr, setShowQr] = useState(false);
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

  // When passbook finishes loading while payment modal is open, auto-update amount
  useEffect(() => {
    if (modalType !== "payment" || passbookLoading || !form?.date) return;
    // Recompute period total with fresh passbook data
    const entries = passbook.entries || [];
    const lastPayment = entries.find(e => e.type === "credit" && e.category === "Payment");
    const fromDate = lastPayment ? (lastPayment.date || "").slice(0, 10) : null;
    const toDate = form.date;
    let total = 0;
    for (const e of entries) {
      const d = (e.date || "").slice(0, 10);
      if (!d || d > toDate) continue;
      if (fromDate && d <= fromDate) continue;
      if (e.type === "debit") total += e.amount;
    }
    if (total > 0) {
      setForm(prev => prev ? { ...prev, amount: total } : prev);
    }
  }, [passbookLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageSkeleton />;
  if (error) return <PageError message={error} onRetry={fetchCustomer} />;
  if (!customer) return <EmptyState text="Customer not found." />;

  const user = customer.user || customer;
  const orders = customer.recentOrders || [];
  const subscriptions = customer.subscriptions || [];


  // Total quantities delivered per product (all time, from delivery history)
  const productTotals = (() => {
    const map = {};
    const COUNTED = new Set(["delivered", "extra", "partial"]);
    for (const sub of subscriptions) {
      const pid  = sub.productId?._id ? String(sub.productId._id) : String(sub.productId || "");
      if (!pid) continue;
      const name = sub.productId?.name || "Product";
      const unit = sub.variantUnit || sub.productId?.unit || "unit";
      const qpd  = Number(sub.quantityPerDay) || 1;
      for (const dh of sub.deliveryHistory || []) {
        if (!COUNTED.has(dh.status || "delivered")) continue;
        const q = Number(dh.actualQuantity || dh.scheduledQuantity || qpd);
        if (!map[pid]) map[pid] = { name, unit, qty: 0 };
        map[pid].qty += isNaN(q) ? qpd : q;
      }
      // If no delivery history entries passed filter, still show the product with 0
      if (!map[pid]) map[pid] = { name, unit, qty: 0 };
    }
    return Object.values(map);
  })();
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

  // Returns { fromDateStr, totalAmount, products: [{name, unit, qty, amount}] }
  // fromDateStr = date of last payment (exclusive lower bound), null = beginning of time
  function computePeriodSummary(toDateStr) {
    const entries = passbook.entries || [];

    // Most recent payment credit (entries are sorted descending by date)
    const lastPayment = entries.find(
      (e) => e.type === "credit" && e.category === "Payment"
    );
    const fromDateStr = lastPayment ? (lastPayment.date || "").slice(0, 10) : null;

    function inRange(raw) {
      const d = String(raw || "").slice(0, 10);
      if (!d || d > toDateStr) return false;
      if (fromDateStr && d <= fromDateStr) return false;
      return true;
    }

    // ── Step 1: aggregate passbook debit entries (authoritative for amount) ──
    let totalAmount = 0;
    const subDebits = {}; // sub._id string → { count, amount }
    for (const e of entries) {
      if (!inRange(e.date) || e.type !== "debit") continue;
      totalAmount += e.amount;
      if (e.category === "Subscription" && e.referenceId) {
        const sid = String(e.referenceId);
        if (!subDebits[sid]) subDebits[sid] = { count: 0, amount: 0 };
        subDebits[sid].count  += 1;
        subDebits[sid].amount += e.amount;
      }
    }

    // ── Step 2: per-product quantity ──
    const productMap = {};
    const COUNTED = new Set(["delivered", "extra", "partial"]);

    for (const sub of subscriptions) {
      const sid       = String(sub._id);
      const pid       = sub.productId?._id ? String(sub.productId._id) : String(sub.productId || "");
      if (!pid) continue;

      const name      = sub.productId?.name || "Product";
      const unit      = sub.variantUnit || sub.productId?.unit || "unit";
      const qtyPerDay = Number(sub.quantityPerDay) || 1;
      const pricePerUnit = sub.pricePerUnit || (sub.totalPricePerDay / qtyPerDay) || 0;

      // Source A: delivery history (most accurate)
      let qtyA = 0;
      let countA = 0;
      for (const dh of sub.deliveryHistory || []) {
        if (!inRange(dh.deliveryDate || dh.date)) continue;
        if (!COUNTED.has(dh.status || "delivered")) continue;
        countA++;
        const q = Number(dh.actualQuantity) || Number(dh.scheduledQuantity) || qtyPerDay;
        qtyA += isNaN(q) ? qtyPerDay : q;
      }

      // Source B: passbook entry count × qtyPerDay (fallback when history is missing/old)
      const debitInfo = subDebits[sid];
      const countB    = debitInfo?.count || 0;
      const qtyB      = countB * qtyPerDay;
      const amountB   = debitInfo?.amount || 0;

      // Pick best qty: prefer delivery history; fall back to passbook count × qtyPerDay
      // If history has deliveries but qty came out 0 (missing fields), use countA × qtyPerDay
      const qty    = qtyA > 0 ? qtyA : (countA > 0 ? countA * qtyPerDay : qtyB);
      const amount = amountB > 0 ? amountB : (qty * pricePerUnit);

      if (qty <= 0 && amount <= 0) continue;

      if (!productMap[pid]) productMap[pid] = { name, unit, qty: 0, amount: 0 };
      productMap[pid].qty    += qty;
      productMap[pid].amount += amount;
    }

    // Debug — remove after confirming quantities show correctly
    if (process.env.NODE_ENV !== "production") {
      console.log("[PaymentSummary]", { toDateStr, fromDateStr, totalAmount, subDebits, products: Object.values(productMap), subscriptionCount: subscriptions.length, passbookEntries: entries.length });
    }

    return {
      fromDateStr,
      totalAmount: Math.max(0, totalAmount),
      products: Object.values(productMap),
    };
  }

  function openAddPayment() {
    const today = new Date().toISOString().split("T")[0];
    // Always refresh passbook so period summary is accurate
    fetchPassbook();
    setForm({
      userId: id,
      amount: user.accountBalance || "",
      transactionId: "",
      notes: "",
      date: today,
    });
    setShowQr(false);
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

    if (modalType === "payment") {
      const parsedAmt = parseFloat(form?.amount);
      if (isNaN(parsedAmt) || parsedAmt <= 0) {
        toast.error("Enter a valid amount.");
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
          : modalType === "payment"
          ? { ...form, amount: parseFloat(form.amount) }
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
    if (modalType === "payment") {
      const upiId   = import.meta.env.VITE_UPI_ID  || "";
      const upiName = import.meta.env.VITE_UPI_NAME || "Farmilky";
      const amt     = parseFloat(form?.amount) || 0;
      const upiUri  = upiId && amt > 0
        ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Farmilky Payment")}`
        : null;
      const waText  = `Hi ${user.name || ""},\nYour outstanding balance is ₹${amt.toFixed(2)}. Please pay at the earliest.${upiId ? `\nPay to UPI: ${upiId}` : ""}`;
      const waUrl   = `https://wa.me/${(user.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`;

      // Period summary for the selected date
      const selectedDate = form?.date || "";
      const summary = selectedDate ? computePeriodSummary(selectedDate) : null;
      const hasDeliveryData = summary && summary.products.length > 0;

      return (
        <div className="payment-form">

          {/* Period breakdown */}
          <div className="payment-period-card">
            <div className="payment-period-header">
              <span className="payment-period-label">
                {passbookLoading
                  ? "Loading period…"
                  : summary?.fromDateStr
                  ? `Since last payment · ${formatDate(summary.fromDateStr)}`
                  : "All time (no prior payments)"}
              </span>
              <span className="payment-period-to">till {selectedDate ? formatDate(selectedDate) : "—"}</span>
            </div>

            {hasDeliveryData ? (
              <div className="payment-period-rows">
                {summary.products.map((p, i) => (
                  <div key={i} className="payment-period-row">
                    <span className="payment-period-pname">{p.name}</span>
                    <span className="payment-period-pqty">{p.qty} {p.unit}</span>
                    <span className="payment-period-pamt">{p.amount > 0 ? formatCurrency(p.amount) : "—"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="payment-period-empty">
                {passbookLoading ? "Calculating…" : "No deliveries in this period."}
              </p>
            )}
          </div>

          {/* Amount input */}
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

          {/* QR toggle */}
          {amt > 0 && (
            <button
              type="button"
              className={`payment-qr-toggle${showQr ? " active" : ""}`}
              onClick={() => setShowQr((v) => !v)}
            >
              <QrCode size={15} />
              {showQr ? "Hide QR" : "Show UPI QR"}
            </button>
          )}

          {/* QR panel */}
          {showQr && (
            <div className="payment-qr-panel">
              {upiUri ? (
                <>
                  <QRCodeSVG value={upiUri} size={200} includeMargin />
                  <div className="payment-qr-meta">
                    <span className="payment-qr-name">{upiName}</span>
                    <span className="payment-qr-upi">{upiId}</span>
                    <span className="payment-qr-amount">{formatCurrency(amt)}</span>
                  </div>
                  {user.phone && (
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-sm">
                      <MessageCircle size={14} /> Share on WhatsApp
                    </a>
                  )}
                </>
              ) : (
                <p className="payment-qr-unconfigured">
                  Set <code>VITE_UPI_ID</code> in your <code>.env</code> to enable UPI QR.
                </p>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={form?.date || ""}
                onChange={(e) => {
                  const newDate = e.target.value;
                  const s = computePeriodSummary(newDate);
                  setShowQr(false);
                  setForm({ ...form, date: newDate, amount: s.totalAmount > 0 ? s.totalAmount : 0 });
                }}
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
    }
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

      {/* Product totals strip */}
      {productTotals.length > 0 && (
        <div className="customer-metrics">
          {productTotals.map((p) => (
            <div key={p.name} className="customer-metric-card metric-info">
              <div className="customer-metric-header">
                <span className="customer-metric-label">{p.name}</span>
              </div>
              <span className="customer-metric-value">{p.qty} <small>{p.unit}</small></span>
            </div>
          ))}
        </div>
      )}

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
              pageSize={15}
              loading={passbookLoading}
              scrollable
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
