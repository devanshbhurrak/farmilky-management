import {
  Edit2, ArrowLeft, MapPin, Phone, Mail, Package,
  CreditCard, CheckCircle2, Clock, XCircle, Truck, ShoppingBag,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiRequest, safeParseJson } from "../api/client";
import { formatCurrency, formatDate, formatTime } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageSkeleton from "../components/ui/PageSkeleton";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Modal from "../components/ui/Modal";
import BottomSheet from "../components/ui/BottomSheet";
import OrderForm from "../components/order/OrderForm";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";
import OutcomeModal from "../components/delivery/OutcomeModal";

const STATUS_META = {
  placed:    { icon: Clock,        color: "var(--warning)",  bg: "var(--warning-bg)"  },
  confirmed: { icon: CheckCircle2, color: "var(--info)",     bg: "var(--info-bg)"     },
  delivered: { icon: Truck,        color: "var(--success)",  bg: "var(--success-bg)"  },
  cancelled: { icon: XCircle,      color: "var(--danger)",   bg: "var(--danger-bg)"   },
};

const TIMELINE = [
  { key: "placed",    label: "Order Placed", dateKey: "createdAt"   },
  { key: "confirmed", label: "Confirmed",    dateKey: "confirmedAt" },
  { key: "delivered", label: "Delivered",    dateKey: "deliveredAt" },
  { key: "cancelled", label: "Cancelled",    dateKey: "cancelledAt" },
];

const STATUS_ORDER = ["placed", "confirmed", "delivered"];

function InfoRow({ icon: Icon, label, value, children }) {
  return (
    <div className="od-info-row">
      <div className="od-info-icon-wrap">
        <Icon size={14} />
      </div>
      <div className="od-info-body">
        <span className="od-info-label">{label}</span>
        {children ?? <span className="od-info-value">{value}</span>}
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [order, setOrder]                 = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [products, setProducts]           = useState([]);
  const [form, setForm]                   = useState(null);
  const [deliverModal, setDeliverModal]   = useState(null);

  const fetchOrder = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiRequest(`/api/order/admin/${id}`);
      if (res.status === 401) { navigate("/login"); return; }
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed to load order"); }
      const data = await res.json();
      setOrder(data.order || data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  useEffect(() => {
    if (!editModalOpen) return;
    apiRequest("/api/products").then(r => r.json())
      .then(data => setProducts(data.products || data || []))
      .catch(() => toast.error("Failed to load products"));
  }, [editModalOpen]);

  function handleStatusUpdate(status) {
    // Show payment mode picker for any delivery — lets admin choose subscription_ledger option
    if (status === "delivered" && order?.orderStatus !== "delivered") {
      setDeliverModal({ mode: "delivered", item: { id, type: "order", userId: order?.userId?._id || order?.userId, scheduledQuantity: 1, unit: "items" }, form: {} });
      return;
    }
    confirmStatusUpdate(status, "pay_at_delivery", undefined);
  }

  async function confirmStatusUpdate(status, paymentMode, subscriptionId) {
    setStatusLoading(true);
    try {
      const body = { status, paymentMode: paymentMode || "pay_at_delivery" };
      if (subscriptionId) body.subscriptionId = subscriptionId;
      const res = await apiRequest(`/api/order/admin/${id}/status`, {
        method: "PUT", body: JSON.stringify(body),
      });
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Update failed"); }
      toast.success(`Order marked as ${status}.`);
      await fetchOrder();
    } catch (err) { toast.error(err.message); }
    finally { setStatusLoading(false); }
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest(`/api/order/admin/${id}`, {
        method: "PUT", body: JSON.stringify(form),
      });
      const payload = await safeParseJson(res);
      if (!res.ok) throw new Error(payload?.message || "Failed to update order");
      toast.success("Order updated!");
      setEditModalOpen(false);
      await fetchOrder();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  function openEdit() {
    setForm({
      userId: order.userId?._id,
      items: order.items.map(item => ({ productId: item.productId?._id || item.productId, quantity: item.quantity })),
      address: order.address || { street: "", city: "", state: "", pincode: "" },
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
    });
    setEditModalOpen(true);
  }

  if (loading) return <PageSkeleton />;
  if (error)   return <EmptyState text={error} action={{ label: "Retry", onClick: fetchOrder }} />;
  if (!order)  return <EmptyState text="Order not found." />;

  const statusMeta  = STATUS_META[order.orderStatus] ?? STATUS_META.placed;
  const StatusIcon  = statusMeta.icon;
  const canAct      = order.orderStatus !== "delivered" && order.orderStatus !== "cancelled";
  const currentStep = STATUS_ORDER.indexOf(order.orderStatus);

  const address = order.address
    ? [order.address.street, order.address.city, order.address.state, order.address.pincode].filter(Boolean).join(", ")
    : null;

  /* ── Stepper (shared) ─────────────────────────────────────── */
  const stepper = order.orderStatus !== "cancelled" && (
    <div className="od-stepper">
      {STATUS_ORDER.map((s, i) => {
        const done   = i <= currentStep;
        const active = i === currentStep;
        return (
          <div key={s} className={`od-step${done ? " od-step--done" : ""}${active ? " od-step--active" : ""}`}>
            <div className="od-step-dot">
              {done && <CheckCircle2 size={14} strokeWidth={2.5} />}
            </div>
            <span className="od-step-label">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
            {i < STATUS_ORDER.length - 1 && (
              <div className={`od-step-line${i < currentStep ? " od-step-line--done" : ""}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  /* ── Items card (shared) ──────────────────────────────────── */
  const itemsCard = (
    <div className="od-card">
      <div className="od-card-header">
        <span className="od-card-title">
          <ShoppingBag size={14} className="od-card-title-icon" />
          Items
        </span>
        <span className="od-card-badge">
          {(order.items || []).length} item{order.items?.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="od-items-list">
        {(order.items || []).map((item, i) => (
          <div key={i} className="od-item-row">
            <div className="od-item-icon-wrap">
              <Package size={14} />
            </div>
            <div className="od-item-info">
              <span className="od-item-name">{item.name}</span>
              <span className="od-item-meta">{item.quantity} × {formatCurrency(item.price)}</span>
            </div>
            <span className="od-item-total">{formatCurrency((item.price || 0) * (item.quantity || 0))}</span>
          </div>
        ))}
        <div className="od-items-total-row">
          <span>Total</span>
          <span>{formatCurrency(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  );

  /* ── Timeline card (shared) ───────────────────────────────── */
  const timelineCard = (
    <div className="od-card">
      <div className="od-card-header">
        <span className="od-card-title">Timeline</span>
      </div>
      <div className="od-timeline">
        {TIMELINE.map((t) => {
          const date = t.key === "placed" ? order.createdAt : order[t.dateKey];
          if (!date) return null;
          return (
            <div key={t.key} className="od-timeline-row">
              <div className="od-timeline-dot" />
              <div className="od-timeline-body">
                <span className="od-timeline-label">{t.label}</span>
                <span className="od-timeline-date">
                  {formatDate(date)}{t.key === "placed" ? ` at ${formatTime(date)}` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  function handleDeliverConfirm({ paymentMode, subscriptionId }) {
    setDeliverModal(null);
    confirmStatusUpdate("delivered", paymentMode, subscriptionId);
  }

  return (
    <div className="view-stack od-page">

      {/* ══════════════════════════════════════════════
          TOP BAR — mobile: ref + badge; desktop: back only
          ══════════════════════════════════════════════ */}
      <div className="od-topbar">
        <Link to="/orders" className="od-back">
          <ArrowLeft size={14} strokeWidth={2.5} />
          <span>Back</span>
        </Link>
        {/* Shown on mobile only (hidden on desktop via CSS) */}
        <div className="od-topbar-right">
          <span className="od-ref">#{order._id?.slice(-8).toUpperCase()}</span>
          <div
            className="od-status-badge"
            style={{ background: statusMeta.bg, color: statusMeta.color }}
          >
            <StatusIcon size={14} strokeWidth={2} />
            <span>{order.orderStatus}</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          HERO CARD — desktop only
          ══════════════════════════════════════════════ */}
      <div className="od-hero">
        <div className="od-hero-left">
          <div>
            <div className="od-hero-top">
              <h1 className="od-order-id">#{order._id?.slice(-8).toUpperCase()}</h1>
              <div
                className="od-status-badge"
                style={{ background: statusMeta.bg, color: statusMeta.color }}
              >
                <StatusIcon size={14} strokeWidth={2} />
                <span>{order.orderStatus}</span>
              </div>
            </div>
            <p className="od-order-meta">
              {order.userId?.name || "Unknown customer"}
              &nbsp;&middot;&nbsp;
              {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
            </p>
          </div>
        </div>
        <div className="od-hero-right">
          <div className="od-total-block">
            <span className="od-total-label">Order Total</span>
            <span className="od-total-amount">{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MOBILE SUMMARY CARD — shown on mobile only
          ══════════════════════════════════════════════ */}
      <div className="od-summary-card">
        <div className="od-summary-amount">{formatCurrency(order.totalAmount)}</div>
        <div className="od-summary-meta">
          <StatusTag value={order.paymentStatus} />
          <span className="od-summary-method">{order.paymentMethod}</span>
        </div>
        <div className="od-summary-who">
          <span className="od-summary-name">{order.userId?.name || "Unknown customer"}</span>
          <span className="od-summary-date">{formatDate(order.createdAt)} at {formatTime(order.createdAt)}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          ACTION STRIP — desktop only, shown when canAct
          ══════════════════════════════════════════════ */}
      {canAct && (
        <div className="od-action-strip">
          <span className="od-action-strip-label">Quick Actions</span>
          <div className="od-action-strip-buttons">
            <button className="btn btn-secondary btn-sm" onClick={openEdit} disabled={statusLoading}>
              <Edit2 size={14} /> Edit
            </button>
            {order.orderStatus === "placed" && (
              <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate("confirmed")} disabled={statusLoading}>
                Confirm Order
              </button>
            )}
            {(order.orderStatus === "placed" || order.orderStatus === "confirmed") && (
              <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate("delivered")} disabled={statusLoading}>
                Mark Delivered
              </button>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => setCancelConfirm(true)} disabled={statusLoading}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          PROGRESS STEPPER
          ══════════════════════════════════════════════ */}
      {stepper}

      {/* ══════════════════════════════════════════════
          MAIN GRID — desktop: 2-col; mobile: single col
          ══════════════════════════════════════════════ */}
      <div className="od-grid">

        {/* LEFT COLUMN — customer, address, payment */}
        <div className="od-col">

          {/* Combined info card (mobile) / separate cards (desktop) */}
          <div className="od-card od-info-card">

            {/* Customer section */}
            <div className="od-info-section">
              <div className="od-card-header">
                <span className="od-card-title">Customer</span>
                {order.userId?._id && (
                  <Link to={`/customers/${order.userId._id}`} className="od-card-link">
                    View profile
                  </Link>
                )}
              </div>
              <div className="od-card-body">
                <p className="od-customer-name">{order.userId?.name || "Unknown"}</p>
                <div className="od-info-stack">
                  {order.userId?.phone && <InfoRow icon={Phone} label="Phone" value={order.userId.phone} />}
                  {order.userId?.email && <InfoRow icon={Mail}  label="Email" value={order.userId.email} />}
                </div>
              </div>
            </div>

            {/* Delivery address section */}
            <div className="od-info-section">
              <div className="od-section-eyebrow">Delivery Address</div>
              <div className="od-card-body">
                {address ? (
                  <InfoRow icon={MapPin} label="Address" value={address} />
                ) : (
                  <p className="od-empty-text">No address provided</p>
                )}
              </div>
            </div>

            {/* Payment section */}
            <div className="od-info-section">
              <div className="od-card-header">
                <span className="od-card-title">Payment</span>
                <StatusTag value={order.paymentStatus} />
              </div>
              <div className="od-card-body">
                <div className="od-info-stack">
                  <InfoRow icon={CreditCard} label="Method" value={order.paymentMethod} />
                  {order.transactionId && (
                    <InfoRow icon={CheckCircle2} label="Transaction">
                      <code className="od-code">{order.transactionId}</code>
                    </InfoRow>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN — items, timeline */}
        <div className="od-col">
          {itemsCard}
          {timelineCard}
        </div>

      </div>

      {/* ══════════════════════════════════════════════
          MOBILE ACTION CARD — inline at bottom, canAct only
          ══════════════════════════════════════════════ */}
      {canAct && (
        <div className="od-actions-card">
          {order.orderStatus === "placed" && (
            <button
              className="od-action-btn-primary"
              onClick={() => handleStatusUpdate("confirmed")}
              disabled={statusLoading}
            >
              Confirm Order
            </button>
          )}
          {(order.orderStatus === "placed" || order.orderStatus === "confirmed") && (
            <button
              className="od-action-btn-primary"
              onClick={() => handleStatusUpdate("delivered")}
              disabled={statusLoading}
            >
              Mark Delivered
            </button>
          )}
          <button
            className="od-action-btn-secondary"
            onClick={openEdit}
            disabled={statusLoading}
          >
            <Edit2 size={14} /> Edit Order
          </button>
          <button
            className="od-action-btn-danger"
            onClick={() => setCancelConfirm(true)}
            disabled={statusLoading}
          >
            Cancel Order
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          DIALOGS & MODALS
          ══════════════════════════════════════════════ */}
      <ConfirmDialog
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={async () => { await handleStatusUpdate("cancelled"); setCancelConfirm(false); }}
        title="Cancel Order"
        message={`Are you sure you want to cancel order #${order._id?.slice(-8)}? This cannot be undone.`}
        confirmText="Cancel Order"
        loading={statusLoading}
      />

      <OutcomeModal
        isMobile={isMobile}
        outcomeModal={deliverModal}
        onClose={() => setDeliverModal(null)}
        onConfirm={handleDeliverConfirm}
        onFormChange={(patch) => setDeliverModal(prev => prev ? { ...prev, form: { ...prev.form, ...patch } } : prev)}
      />

      {isMobile ? (
        <BottomSheet isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Order">
          {form && (
            <OrderForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              products={products}
              customers={[order.userId]}
              onSubmit={handleSave}
              saving={saving}
            />
          )}
          <div className="product-sheet-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </BottomSheet>
      ) : (
        <Modal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Edit Order"
          footer={
            <div className="product-modal-footer">
              <div />
              <div className="product-modal-footer-right">
                <button className="btn btn-secondary btn-sm" onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          }
        >
          {form && (
            <OrderForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              products={products}
              customers={[order.userId]}
              onSubmit={handleSave}
              saving={saving}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
