import {
  Edit2, Play, Pause, XCircle,
  Package, Repeat2, IndianRupee, CalendarDays, Truck,
  Phone, Mail, User, CheckCircle2, AlertCircle, Clock,
  PlusCircle, Pencil,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiRequest, safeParseJson } from "../api/client";
import { formatCurrency, formatDate, todayLocal, toLocalDateStr } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageSkeleton from "../components/ui/PageSkeleton";
import PageHeader from "../components/ui/PageHeader";
import PageError from "../components/ui/PageError";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import SubscriptionForm from "../components/subscription/SubscriptionForm";
import DeliveryHistoryForm from "../components/subscription/DeliveryHistoryForm";
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
      <div className="sd-stat-icon"><Icon size={16} strokeWidth={1.75} /></div>
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

  const [sub, setSub]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [products, setProducts]     = useState([]);
  const [form, setForm]             = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyForm, setHistoryForm]           = useState(null);
  const [historySaving, setHistorySaving]       = useState(false);
  const [editingEntry, setEditingEntry]         = useState(null);

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
      return true;
    } catch (err) { toast.error(err.message); return false; }
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
      variantId: sub.variantId || null,
      quantityPerDay: sub.quantityPerDay,
      pricePerUnit: sub.pricePerUnit ?? sub.productId?.price ?? null,
      deliverySchedule: sub.deliverySchedule,
      customDays: sub.customDays || [],
      startDate: sub.startDate ? new Date(sub.startDate).toISOString().split("T")[0] : "",
    });
    setEditModalOpen(true);
  }

  function openAddHistory() {
    setEditingEntry(null);
    setHistoryForm({
      date: todayLocal(),
      status: "delivered",
      actualQuantity: sub?.quantityPerDay ?? "",
      reason: "",
      notes: "",
    });
    setHistoryModalOpen(true);
  }

  function openEditHistory(entry) {
    const rawDate = entry.deliveryDate || entry.date;
    setEditingEntry(entry);
    setHistoryForm({
      date: toLocalDateStr(rawDate),
      status: entry.status || "delivered",
      actualQuantity: entry.actualQuantity ?? entry.quantityDelivered ?? "",
      reason: entry.reason || "",
      notes: entry.notes || "",
    });
    setHistoryModalOpen(true);
  }

  async function handleHistorySave(e) {
    if (e) e.preventDefault();
    setHistorySaving(true);
    try {
      const body = {
        deliveryDate: historyForm.date,
        status: historyForm.status,
        ...(historyForm.actualQuantity ? { actualQuantity: historyForm.actualQuantity } : {}),
        ...(historyForm.reason ? { reason: historyForm.reason } : {}),
        ...(historyForm.notes ? { notes: historyForm.notes } : {}),
      };
      const res = await apiRequest(`/api/subscriptions/admin/${id}/delivery-outcome`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const payload = await safeParseJson(res);
      if (!res.ok) throw new Error(payload?.message || "Failed to save");
      toast.success(editingEntry ? "Delivery record updated." : "Delivery record added.");
      setHistoryModalOpen(false);
      await fetchSub();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setHistorySaving(false);
    }
  }

  if (loading) return <PageSkeleton />;
  if (error)   return <PageError message={error} onRetry={fetchSub} />;
  if (!sub)    return <EmptyState text="Subscription not found." />;

  const history             = sub.deliveryHistory || [];
  const unit                = sub.variantUnit || sub.productId?.unit || "unit";
  const effectivePrice      = sub.pricePerUnit ?? (sub.totalPricePerDay / sub.quantityPerDay);
  const isCustomPrice       = sub.pricePerUnit != null && sub.productId && sub.pricePerUnit !== sub.productId.price;
  const totalDelivered      = history.filter(d => (d.status || "delivered") === "delivered").length;
  const statusMeta          = STATUS_META[sub.status] ?? STATUS_META.active;
  const StatusIcon          = statusMeta.icon;
  const scheduleLabel       = SCHEDULE_LABEL[sub.deliverySchedule] || sub.deliverySchedule;

  const getDate   = (d) => d.deliveryDate || d.date;
  const getStatus = (d) => d.status || "delivered";
  const getActual = (d) => d.actualQuantity ?? d.quantityDelivered ?? d.scheduledQuantity ?? sub.quantityPerDay;

  return (
    <div className="view-stack sd-page">

      {/* ── Top bar ───────────────────────────────────── */}
      <PageHeader
        title={sub.productId?.name || "Subscription"}
        subtitle={`#${sub._id?.slice(-6).toUpperCase()} · ${sub.userId?.name || "Unknown"}`}
        breadcrumb={[
          { label: "Subscriptions", path: "/subscriptions" },
          { label: sub.productId?.name || "Subscription" },
        ]}
      />

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
                <StatusIcon size={14} strokeWidth={2.5} />
                <span>{sub.status}</span>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={openEdit}
                title="Edit subscription"
                aria-label="Edit subscription"
              >
                <Edit2 size={16} />
              </button>
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
            <button
              type="button"
              className="icon-button"
              onClick={openEdit}
              title="Edit subscription"
              aria-label="Edit subscription"
            >
              <Edit2 size={16} />
            </button>
          </div>
        <div className="sd-summary-chips">
          <span className="sd-chip"><Repeat2 size={11} /> {scheduleLabel}</span>
          <span className="sd-chip"><Package size={11} /> {sub.quantityPerDay} {unit}/day</span>
          <span className="sd-chip sd-chip--money"><IndianRupee size={11} /> {formatCurrency(sub.totalPricePerDay)}/day</span>
        </div>
      </div>

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
              <span className="sd-card-title"><Package size={14} className="sd-card-title-icon" /> Plan Details</span>
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
              <span className="sd-card-title"><User size={14} className="sd-card-title-icon" /> Customer</span>
              {sub.userId?._id && (
                <Link to={`/customers/${sub.userId._id}`} className="sd-card-link">View profile</Link>
              )}
            </div>
            <div className="sd-card-body">
              <p className="sd-customer-name">{sub.userId?.name || "Unknown"}</p>
              <div className="sd-contact-rows">
                {sub.userId?.phone && (
                  <div className="sd-contact-row">
                    <Phone size={14} className="sd-contact-icon" />
                    <span>{sub.userId.phone}</span>
                  </div>
                )}
                {sub.userId?.email && (
                  <div className="sd-contact-row">
                    <Mail size={14} className="sd-contact-icon" />
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
              <span className="sd-card-title"><Truck size={14} className="sd-card-title-icon" /> Delivery History</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="sd-card-badge">{history.length} records</span>
                {sub.status !== "cancelled" && (
                  <button className="btn btn-secondary btn-sm" onClick={openAddHistory}>
                    <PlusCircle size={13} style={{ marginRight: 4 }} /> Add Record
                  </button>
                )}
              </div>
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
                        <th></th>
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
                            <td>
                              <button className="btn btn-ghost btn-xs" title="Edit" onClick={() => openEditHistory(d)}>
                                <Pencil size={12} />
                              </button>
                            </td>
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
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span className="sd-history-amount">{formatCurrency(d.totalAmount)}</span>
                              <button className="btn btn-ghost btn-xs" onClick={() => openEditHistory(d)}>
                                <Pencil size={12} />
                              </button>
                            </div>
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

      {/* ── Dialogs ───────────────────────────────────── */}
      <ConfirmDialog
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={async () => {
          const ok = await handleStatusUpdate("cancelled");
          if (ok) { setCancelConfirm(false); setEditModalOpen(false); }
        }}
        title="Cancel Subscription"
        message={`Cancel subscription for ${sub.userId?.name || "this customer"}? This cannot be undone.`}
        confirmText="Cancel Subscription"
      />

      <ResponsiveModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Subscription"
        footer={
          <div className="product-modal-footer">
            <div />
            <div className="product-modal-footer-right">
              <button className="btn btn-secondary btn-sm" onClick={() => setEditModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving\u2026" : "Save Changes"}
              </button>
            </div>
          </div>
        }
      >
        {form && (
          <div className="form-stack">
            {sub.status !== "cancelled" && (
              <>
                <div className="customer-form-section-head">
                  <div className="customer-form-section-icon" aria-hidden="true">
                    <Repeat2 size={14} />
                  </div>
                  <span className="customer-form-section-title">Subscription Status</span>
                </div>
                <div className="sd-status-actions">
                  {sub.status !== "active" && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={async () => { if (await handleStatusUpdate("active")) setEditModalOpen(false); }}
                    >
                      <Play size={14} /> Activate
                    </button>
                  )}
                  {sub.status === "active" && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={async () => { if (await handleStatusUpdate("paused")) setEditModalOpen(false); }}
                    >
                      <Pause size={14} /> Pause
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setCancelConfirm(true)}
                  >
                    <XCircle size={14} /> Cancel Subscription
                  </button>
                </div>
              </>
            )}
            <SubscriptionForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              products={products}
              customers={[sub.userId]}
              onSubmit={handleSave}
              saving={saving}
            />
          </div>
        )}
      </ResponsiveModal>

      <ResponsiveModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={editingEntry ? "Edit Delivery Record" : "Add Delivery Record"}
        footer={
          <div className="product-modal-footer">
            <div />
            <div className="product-modal-footer-right">
              <button className="btn btn-secondary btn-sm" onClick={() => setHistoryModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleHistorySave} disabled={historySaving}>
                {historySaving ? "Saving\u2026" : editingEntry ? "Update Record" : "Add Record"}
              </button>
            </div>
          </div>
        }
      >
        {historyForm && (
          <DeliveryHistoryForm
            form={historyForm}
            onChange={(updates) => setHistoryForm(f => ({ ...f, ...updates }))}
            subscription={sub}
            onSubmit={handleHistorySave}
            saving={historySaving}
          />
        )}
      </ResponsiveModal>
    </div>
  );
}
