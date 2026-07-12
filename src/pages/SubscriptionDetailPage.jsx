import { ChevronRight, Play, Pause, XCircle, Edit2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiRequest, safeParseJson } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageSkeleton from "../components/ui/PageSkeleton";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import BottomSheet from "../components/ui/BottomSheet";
import SubscriptionForm from "../components/subscription/SubscriptionForm";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

export default function SubscriptionDetailPage() {
  const { id } = useParams();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);

  const fetchSub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/subscriptions/admin/${id}`);
      if (res.status === 401) return;
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed to load subscription"); }
      const data = await res.json();
      setSub(data.subscription || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchSub(); }, [fetchSub]);

  useEffect(() => {
    if (editModalOpen) {
      apiRequest("/api/products")
        .then(r => r.json())
        .then(data => setProducts(data.products || data || []))
        .catch(() => toast.error("Failed to load products"));
    }
  }, [editModalOpen]);

  async function handleStatusUpdate(status) {
    try {
      const res = await apiRequest(`/api/subscriptions/admin/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Update failed"); }
      toast.success(`Subscription ${status}.`);
      await fetchSub();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest(`/api/subscriptions/admin/${id}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      const payload = await safeParseJson(res);
      if (!res.ok) throw new Error(payload?.message || "Failed to update subscription");
      
      toast.success("Subscription updated!");
      setEditModalOpen(false);
      await fetchSub();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit() {
    setForm({
      userId: sub.userId?._id,
      productId: sub.productId?._id,
      quantityPerDay: sub.quantityPerDay,
      pricePerUnit: sub.pricePerUnit ?? sub.productId?.price ?? null,
      deliverySchedule: sub.deliverySchedule,
      customDays: sub.customDays || [],
      startDate: sub.startDate ? new Date(sub.startDate).toISOString().split("T")[0] : ""
    });
    setEditModalOpen(true);
  }

  if (loading) return <PageSkeleton />;
  if (error) return <EmptyState text={error} action={{ label: "Retry", onClick: fetchSub }} />;
  if (!sub) return <EmptyState text="Subscription not found." />;

  const deliveryHistory = sub.deliveryHistory || [];
  const totalDelivered = deliveryHistory.length;
  const effectivePricePerUnit = sub.pricePerUnit ?? (sub.totalPricePerDay / sub.quantityPerDay);
  const isCustomPrice = sub.pricePerUnit != null && sub.productId && sub.pricePerUnit !== sub.productId.price;
  const getHistoryDate = (entry) => entry.deliveryDate || entry.date;
  const getHistoryStatus = (entry) => entry.status || "delivered";
  const getScheduledQuantity = (entry) => entry.scheduledQuantity ?? sub.quantityPerDay;
  const getActualQuantity = (entry) => entry.actualQuantity ?? entry.quantityDelivered ?? getScheduledQuantity(entry);

  const actionButtons = (
    <>
      <button className="action-btn action-btn-secondary" onClick={openEdit}>
        <Edit2 size={14} />
        <span>Edit</span>
      </button>
      {sub.status !== "active" && (
        <button className="action-btn action-btn-primary" onClick={() => handleStatusUpdate("active")}>
          <Play size={14} />
          <span>Activate</span>
        </button>
      )}
      {sub.status === "active" && (
        <button className="action-btn action-btn-warning" onClick={() => handleStatusUpdate("paused")}>
          <Pause size={14} />
          <span>Pause</span>
        </button>
      )}
      {sub.status !== "cancelled" && (
        <button className="action-btn action-btn-danger" onClick={() => setCancelConfirm(true)}>
          <XCircle size={14} />
          <span>Cancel</span>
        </button>
      )}
    </>
  );

  return (
    <div className="view-stack">
      <PageHeader
        title={sub.productId?.name || "Unknown Product"}
        subtitle={`Customer: ${sub.userId?.name || "Unknown"}${sub.userId?.phone ? ` · ${sub.userId.phone}` : ""}`}
        breadcrumb={[
          { label: "Subscriptions", path: "/subscriptions" },
          { label: `#${sub._id?.slice(-8).toUpperCase()}` }
        ]}
        actions={
          <div className="detail-actions">
            <StatusTag value={sub.status} />
            <div className="detail-actions-buttons">{actionButtons}</div>
          </div>
        }
      />

      <div className="metrics-grid">
        <div className="card-inset card-metric">
          <span className="card-metric-label">DAILY VALUE</span>
          <strong className="card-metric-value">{formatCurrency(sub.totalPricePerDay)}</strong>
        </div>
        <div className="card-inset card-metric">
          <span className="card-metric-label">
            RATE / {(sub.variantUnit || sub.productId?.unit)?.toUpperCase() || "UNIT"}
            {isCustomPrice && <span className="price-badge" style={{ marginLeft: "5px" }}>CUSTOM</span>}
          </span>
          <strong className="card-metric-value" style={{ color: isCustomPrice ? "var(--color-warning)" : undefined }}>
            {formatCurrency(effectivePricePerUnit)}
          </strong>
        </div>
        <div className="card-inset card-metric">
          <span className="card-metric-label">DELIVERIES</span>
          <strong className="card-metric-value" style={{ color: "var(--color-primary)" }}>{totalDelivered}</strong>
        </div>
        <div className="card-inset card-metric">
          <span className="card-metric-label">PENDING</span>
          <strong className="card-metric-value" style={{ color: sub.pendingAmount > 0 ? "var(--danger)" : undefined }}>{formatCurrency(sub.pendingAmount)}</strong>
        </div>
      </div>

      <div className="two-column-grid">
        <section className="panel">
          <p className="eyebrow">Plan Details</p>
          <div className="stack-list" style={{ marginTop: "var(--space-4)" }}>
            <div className="list-card">
              <div>
                <strong>Schedule</strong>
                <span>How often we deliver</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ textTransform: "capitalize" }}>{sub.deliverySchedule}</strong>
              </div>
            </div>
            <div className="list-card">
              <div>
                <strong>Quantity</strong>
                <span>Standard daily amount</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>{sub.quantityPerDay} {(sub.variantUnit || sub.productId?.unit)}</strong>
              </div>
            </div>
            <div className="list-card">
              <div>
                <strong>Price per {(sub.variantUnit || sub.productId?.unit) || "unit"}</strong>
                <span>{isCustomPrice ? "Custom negotiated rate" : "Standard product rate"}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ color: isCustomPrice ? "var(--color-warning, #b45309)" : "inherit" }}>
                  {formatCurrency(effectivePricePerUnit)}
                </strong>
                {isCustomPrice && (
                  <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                    List: {formatCurrency(sub.productId?.price)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Customer</p>
          <div className="stack-list" style={{ marginTop: "var(--space-4)" }}>
            <Link to={`/customers/${sub.userId?._id}`} className="list-card">
              <div>
                <strong>{sub.userId?.name || "Unknown"}</strong>
                <span>{sub.userId?.email}{sub.userId?.phone ? ` · ${sub.userId.phone}` : ""}</span>
              </div>
              <ChevronRight size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            </Link>
          </div>
        </section>
      </div>

      <section className="panel">
        <p className="eyebrow">Delivery History</p>
        {deliveryHistory.length === 0 ? (
          <EmptyState text="No deliveries recorded yet." />
        ) : isMobile ? (
          <div className="stack-list" style={{ marginTop: "var(--space-4)" }}>
            {deliveryHistory.map((d, i) => (
              <div key={i} className="list-card">
                <div>
                  <strong>{formatDate(getHistoryDate(d))}</strong>
                  <span>{getActualQuantity(d)} {(sub.variantUnit || sub.productId?.unit)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                  <StatusTag value={getHistoryStatus(d)} />
                  <strong>{formatCurrency(d.totalAmount)}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-shell" style={{ marginTop: "var(--space-4)" }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                  <th>Actual</th>
                  <th>Rate</th>
                  <th>Reason</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {deliveryHistory.map((d, i) => (
                  <tr key={i}>
                    <td>{formatDate(getHistoryDate(d))}</td>
                    <td><StatusTag value={getHistoryStatus(d)} /></td>
                    <td>{getScheduledQuantity(d)} {(sub.variantUnit || sub.productId?.unit)}</td>
                    <td>{getActualQuantity(d)} {(sub.variantUnit || sub.productId?.unit)}</td>
                    <td>{d.pricePerUnit != null ? formatCurrency(d.pricePerUnit) : "-"}</td>
                    <td>{d.reason || "-"}</td>
                    <td><strong>{formatCurrency(d.totalAmount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={async () => {
          await handleStatusUpdate("cancelled");
          setCancelConfirm(false);
        }}
        title="Cancel Subscription"
        message={`Are you sure you want to cancel this subscription for ${sub.userId?.name || "this customer"}? This action cannot be undone.`}
        confirmText="Cancel Subscription"
      />

      {isMobile ? (
        <BottomSheet
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Edit Subscription"
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
          <div className="product-sheet-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
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
                  {saving ? "Saving..." : "Save Changes"}
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
