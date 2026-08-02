import {
  ArrowLeft, Edit2, Play, Pause, XCircle,
  Package, Repeat2, IndianRupee, CalendarDays, Truck,
  Phone, Mail, User, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiRequest, safeParseJson } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageSkeleton from "../components/ui/PageSkeleton";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Modal from "../components/ui/Modal";
import BottomSheet from "../components/ui/BottomSheet";
import SubscriptionForm from "../components/subscription/SubscriptionForm";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

const STATUS_META = {
  active:    { color: "var(--success)",  bg: "var(--success-bg)",  icon: CheckCircle2 },
  paused:    { color: "var(--warning)",  bg: "var(--warning-bg)",  icon: Clock        },
  cancelled: { color: "var(--danger)",   bg: "var(--danger-bg)",   icon: XCircle      },
};

const SCHEDULE_LABEL = {
  daily: "Daily", alternate: "Every Other Day", weekly: "Weekly",
};

const HISTORY_STATUS_COLOR = {
  delivered: { dot: "var(--success)", bg: "var(--success-bg)",  text: "var(--success-text)"  },
  failed:    { dot: "var(--danger)",  bg: "var(--danger-bg)",   text: "var(--danger-text)"   },
  skipped:   { dot: "var(--warning)", bg: "var(--warning-bg)",  text: "var(--warning-text)"  },
};

function StatCard({ icon: Icon, label, value, valueColor, sub: subText }) {
  return (
    <div className="sd-stat">
      <div className="sd-stat-icon"><Icon size={15} strokeWidth={1.75} /></div>
      <div className="sd-stat-body">
        <span className="sd-stat-label">{label}</span>
        <span className="sd-stat-value" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
        {subText && <span className="sd-stat-sub">{subText}</span>}
      </div>
    </div>
  );
}

export default function SubscriptionDetailPage() {
  const { id } = useParams();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [sub, setSub]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [products, setProducts]     = useState([]);
  const [form, setForm]             = useState(null);

  const fetchSub = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiRequest(`/api/subscriptions/admin/${id}`);
      if (res.status === 401) return;
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed to load"); }
      const data = await res.json();
      setSub(data.subscription || data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchSub(); }, [fetchSub]);

  useEffect(() => {
    if (!editModalOpen) return;
    apiRequest("/api/products").then(r => r.json())
      .then(data => setProducts(data.products || data || []))
      .catch(() => toast.error("Failed to load products"));
  }, [editModalOpen]);

  async function handleStatusUpdate(status) {
    try {
      const res = await apiRequest(`/api/subscriptions/admin/${id}/status`, {
        method: "PUT", body: JSON.stringify({ status }),
      });
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Update failed"); }
      toast.success(`Subscription ${status}.`);
      await fetchSub();
    } catch (err) { toast.error(err.message); }
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest(`/api/subscriptions/admin/${id}`, {
        method: "PUT", body: JSON.stringify(form),
      });
      const payload = await safeParseJson(res);
      if (!res.ok) throw new Error(payload?.message || "Failed to update");
      toast.success("Subscription updated!");
      setEditModalOpen(false);
      await fetchSub();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  function openEdit() {
    setForm({
      userId: sub.userId?._id,
      productId: sub.productId?._id,
      quantityPerDay: sub.quantityPerDay,
      pricePerUnit: sub.pricePerUnit ?? sub.productId?.price ?? null,
      deliverySchedule: sub.deliverySchedule,
      customDays: sub.customDays || [],
      startDate: sub.startDate ? new Date(sub.startDate).toISOString().split("T")[0] : "",
    });
    setEditModalOpen(true);
  }

  if (loading) return <PageSkeleton />;
  if (error)   return <EmptyState text={error} action={{ label: "Retry", onClick: fetchSub }} />;
  if (!sub)    return <EmptyState text="Subscription not found." />;

  const history             = sub.deliveryHistory || [];
  const unit                = sub.variantUnit || sub.productId?.unit || "unit";
  const effectivePrice      = sub.pricePerUnit ?? (sub.totalPricePerDay / sub.quantityPerDay);
  const isCustomPrice       = sub.pricePerUnit != null && sub.productId && sub.pricePerUnit !== sub.productId.price;
  const totalDelivered      = history.filter(d => (d.status || "delivered") === "delivered").length;
  const statusMeta          = STATUS_META[sub.status] ?? STATUS_META.active;
  const StatusIcon          = statusMeta.icon;
  const canAct              = sub.status !== "cancelled";
  const scheduleLabel       = SCHEDULE_LABEL[sub.deliverySchedule] || sub.deliverySchedule;

  const getDate   = (d) => d.deliveryDate || d.date;
  const getStatus = (d) => d.status || "delivered";
  const getActual = (d) => d.actualQuantity ?? d.quantityDelivered ?? d.scheduledQuantity ?? sub.quantityPerDay;

  return (
    <div className="view-stack sd-page">

      {/* ── Top bar ───────────────────────────────────── */}
      <div className="sd-topbar">
        <Link to="/subscriptions" className="sd-back">
          <ArrowLeft size={14} strokeWidth={2.5} />
          <span>Subscriptions</span>
        </Link>
        <div className="sd-topbar-right">
          <span className="sd-topbar-ref">#{sub._id?.slice(-6).toUpperCase()}</span>
          <div className="sd-status-badge" style={{ background: statusMeta.bg, color: statusMeta.color }}>
            <StatusIcon size={12} strokeWidth={2.5} />
            <span>{sub.status}</span>
          </div>
        </div>
      </div>

      {/* ── Hero card (desktop) ───────────────────────── */}
      <div className="sd-hero">
        <div className="sd-hero-product">
          <div className="sd-hero-product-icon">
            {sub.productId?.image
              ? <img src={sub.productId.image} alt={sub.productId.name} className="sd-hero-img" />
              : <Package size={22} strokeWidth={1.5} />
            }
          </div>
          <div className="sd-hero-product-info">
            <div className="sd-hero-top">
              <h1 className="sd-hero-name">{sub.productId?.name || "Unknown Product"}</h1>
              <div className="sd-status-badge" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                <StatusIcon size={12} strokeWidth={2.5} />
                <span>{sub.status}</span>
              </div>
            </div>
            <p className="sd-hero-meta">
              {sub.userId?.name || "Unknown"}
              {sub.userId?.phone && <> &middot; {sub.userId.phone}</>}
              &nbsp;&middot;&nbsp;Since {formatDate(sub.startDate)}
            </p>
          </div>
        </div>
        <div className="sd-hero-stats">
          <div className="sd-hero-stat">
            <span className="sd-hero-stat-label">Daily</span>
            <span className="sd-hero-stat-value">{formatCurrency(sub.totalPricePerDay)}</span>
          </div>
          <div className="sd-hero-stat-divider" />
          <div className="sd-hero-stat">
            <span className="sd-hero-stat-label">Qty / Day</span>
            <span className="sd-hero-stat-value">{sub.quantityPerDay} {unit}</span>
          </div>
          <div className="sd-hero-stat-divider" />
          <div className="sd-hero-stat">
            <span className="sd-hero-stat-label">Schedule</span>
            <span className="sd-hero-stat-value">{scheduleLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Mobile summary card ───────────────────────── */}
      <div className="sd-summary-card">
        <div className="sd-summary-product">
          <div className="sd-summary-product-icon">
            {sub.productId?.image
              ? <img src={sub.productId.image} alt={sub.productId.name} className="sd-summary-img" />
              : <Package size={18} strokeWidth={1.5} />
            }
          </div>
          <div className="sd-summary-info">
            <p className="sd-summary-name">{sub.productId?.name || "Unknown Product"}</p>
            <p className="sd-summary-since">
              <User size={10} /> {sub.userId?.name || "Unknown"}
              &nbsp;&middot;&nbsp;Since {formatDate(sub.startDate)}
            </p>
          </div>
        </div>
        <div className="sd-summary-chips">
          <span className="sd-chip"><Repeat2 size={11} /> {scheduleLabel}</span>
          <span className="sd-chip"><Package size={11} /> {sub.quantityPerDay} {unit}/day</span>
          <span className="sd-chip sd-chip--money"><IndianRupee size={11} /> {formatCurrency(sub.totalPricePerDay)}/day</span>
        </div>
      </div>

      {/* ── Action strip (desktop) ────────────────────── */}
      {canAct && (
        <div className="sd-action-strip">
          <span className="sd-action-strip-label">Actions</span>
          <div className="sd-action-strip-buttons">
            <button className="btn btn-secondary btn-sm" onClick={openEdit}>
              <Edit2 size={13} /> Edit
            </button>
            {sub.status !== "active" && (
              <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate("active")}>
                <Play size={13} /> Activate
              </button>
            )}
            {sub.status === "active" && (
              <button className="btn btn-secondary btn-sm" onClick={() => handleStatusUpdate("paused")}>
                <Pause size={13} /> Pause
              </button>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => setCancelConfirm(true)}>
              <XCircle size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────── */}
      <div className="sd-stats-row">
        <StatCard
          icon={IndianRupee}
          label="Daily Value"
          value={formatCurrency(sub.totalPricePerDay)}
        />
        <StatCard
          icon={Truck}
          label="Deliveries"
          value={totalDelivered}
          valueColor="var(--color-primary)"
          subText={`of ${history.length} total`}
        />
        <StatCard
          icon={AlertCircle}
          label="Pending Due"
          value={formatCurrency(sub.pendingAmount || 0)}
          valueColor={sub.pendingAmount > 0 ? "var(--danger)" : "var(--success)"}
          subText={sub.pendingAmount > 0 ? "Outstanding" : "All clear"}
        />
        <StatCard
          icon={CalendarDays}
          label="Next Delivery"
          value={sub.nextDeliveryDate ? formatDate(sub.nextDeliveryDate) : "—"}
        />
      </div>

      {/* ── Main grid ─────────────────────────────────── */}
      <div className="sd-grid">

        {/* LEFT — plan + customer */}
        <div className="sd-col">

          {/* Plan details */}
          <div className="sd-card">
            <div className="sd-card-header">
              <span className="sd-card-title"><Package size={13} className="sd-card-title-icon" /> Plan Details</span>
            </div>
            <div className="sd-plan-rows">
              <div className="sd-plan-row">
                <span className="sd-plan-key">Product</span>
                <span className="sd-plan-val">{sub.productId?.name || "—"}</span>
              </div>
              <div className="sd-plan-row">
                <span className="sd-plan-key">Schedule</span>
                <span className="sd-plan-val">{scheduleLabel}</span>
              </div>
              <div className="sd-plan-row">
                <span className="sd-plan-key">Quantity / Day</span>
                <span className="sd-plan-val">{sub.quantityPerDay} {unit}</span>
              </div>
              <div className="sd-plan-row">
                <span className="sd-plan-key">Rate / {unit}</span>
                <span className="sd-plan-val sd-plan-val--price">
                  {formatCurrency(effectivePrice)}
                  {isCustomPrice && <span className="sd-custom-tag">Custom</span>}
                </span>
              </div>
              {isCustomPrice && sub.productId?.price && (
                <div className="sd-plan-row">
                  <span className="sd-plan-key">List Price</span>
                  <span className="sd-plan-val sd-plan-val--muted">{formatCurrency(sub.productId.price)} / {unit}</span>
                </div>
              )}
              <div className="sd-plan-row">
                <span className="sd-plan-key">Daily Total</span>
                <span className="sd-plan-val sd-plan-val--bold">{formatCurrency(sub.totalPricePerDay)}</span>
              </div>
              <div className="sd-plan-row">
                <span className="sd-plan-key">Start Date</span>
                <span className="sd-plan-val">{formatDate(sub.startDate)}</span>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="sd-card">
            <div className="sd-card-header">
              <span className="sd-card-title"><User size={13} className="sd-card-title-icon" /> Customer</span>
              {sub.userId?._id && (
                <Link to={`/customers/${sub.userId._id}`} className="sd-card-link">View profile</Link>
              )}
            </div>
            <div className="sd-card-body">
              <p className="sd-customer-name">{sub.userId?.name || "Unknown"}</p>
              <div className="sd-contact-rows">
                {sub.userId?.phone && (
                  <div className="sd-contact-row">
                    <Phone size={12} className="sd-contact-icon" />
                    <span>{sub.userId.phone}</span>
                  </div>
                )}
                {sub.userId?.email && (
                  <div className="sd-contact-row">
                    <Mail size={12} className="sd-contact-icon" />
                    <span>{sub.userId.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT — delivery history */}
        <div className="sd-col">
          <div className="sd-card">
            <div className="sd-card-header">
              <span className="sd-card-title"><Truck size={13} className="sd-card-title-icon" /> Delivery History</span>
              <span className="sd-card-badge">{history.length} records</span>
            </div>

            {history.length === 0 ? (
              <div className="sd-empty">
                <Truck size={28} strokeWidth={1.25} />
                <p>No deliveries recorded yet</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="sd-table-wrap">
                  <table className="sd-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().map((d, i) => {
                        const s = getStatus(d);
                        return (
                          <tr key={i} className={`sd-tr sd-tr--${s}`}>
                            <td className="sd-td-date">{formatDate(getDate(d))}</td>
                            <td><StatusTag value={s} /></td>
                            <td className="sd-td-num">{getActual(d)} {unit}</td>
                            <td className="sd-td-num">{d.pricePerUnit != null ? formatCurrency(d.pricePerUnit) : "—"}</td>
                            <td className="sd-td-amount">{formatCurrency(d.totalAmount)}</td>
                            <td className="sd-td-reason">{d.reason || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile list */}
                <div className="sd-history-list">
                  {[...history].reverse().map((d, i) => {
                    const s = getStatus(d);
                    const colors = HISTORY_STATUS_COLOR[s] || HISTORY_STATUS_COLOR.delivered;
                    return (
                      <div key={i} className="sd-history-row">
                        <div className="sd-history-dot" style={{ background: colors.dot }} />
                        <div className="sd-history-body">
                          <div className="sd-history-top">
                            <span className="sd-history-date">{formatDate(getDate(d))}</span>
                            <span className="sd-history-amount">{formatCurrency(d.totalAmount)}</span>
                          </div>
                          <div className="sd-history-meta">
                            <span className="sd-history-qty">{getActual(d)} {unit}</span>
                            <StatusTag value={s} />
                            {d.reason && <span className="sd-history-reason">{d.reason}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* ── Mobile action card ────────────────────────── */}
      {canAct && (
        <div className="sd-actions-card">
          <div className="sd-actions-row">
            {sub.status !== "active" ? (
              <button className="sd-action-btn sd-action-btn--primary" onClick={() => handleStatusUpdate("active")}>
                <Play size={12} /> Activate
              </button>
            ) : (
              <button className="sd-action-btn sd-action-btn--secondary" onClick={() => handleStatusUpdate("paused")}>
                <Pause size={12} /> Pause
              </button>
            )}
            <button className="sd-action-btn sd-action-btn--secondary" onClick={openEdit}>
              <Edit2 size={12} /> Edit Plan
            </button>
          </div>
          <button className="sd-action-btn sd-action-btn--danger" onClick={() => setCancelConfirm(true)}>
            <XCircle size={11} /> Cancel Subscription
          </button>
        </div>
      )}

      {/* ── Dialogs ───────────────────────────────────── */}
      <ConfirmDialog
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={async () => { await handleStatusUpdate("cancelled"); setCancelConfirm(false); }}
        title="Cancel Subscription"
        message={`Cancel subscription for ${sub.userId?.name || "this customer"}? This cannot be undone.`}
        confirmText="Cancel Subscription"
      />

      {isMobile ? (
        <BottomSheet isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Subscription">
          {form && (
            <SubscriptionForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              products={products}
              customers={[sub.userId]}
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
          title="Edit Subscription"
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
            <SubscriptionForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              products={products}
              customers={[sub.userId]}
              onSubmit={handleSave}
              saving={saving}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
