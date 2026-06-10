import { ChevronRight, Play, Pause, XCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiRequest, safeParseJson } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageSkeleton from "../components/ui/PageSkeleton";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

export default function SubscriptionDetailPage() {
  const { id } = useParams();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

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

  if (loading) return <PageSkeleton />;
  if (error) return <EmptyState text={error} action={{ label: "Retry", onClick: fetchSub }} />;
  if (!sub) return <EmptyState text="Subscription not found." />;

  const deliveryHistory = sub.deliveryHistory || [];
  const totalDelivered = deliveryHistory.length;
  const getHistoryDate = (entry) => entry.deliveryDate || entry.date;
  const getHistoryStatus = (entry) => entry.status || "delivered";
  const getScheduledQuantity = (entry) => entry.scheduledQuantity ?? sub.quantityPerDay;
  const getActualQuantity = (entry) => entry.actualQuantity ?? entry.quantityDelivered ?? getScheduledQuantity(entry);

  const actionButtons = (
    <>
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

      <div className="card-grid" style={{ gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)" }}>
        <div className="card-inset" style={{ textAlign: "center" }}>
          <span style={{ display: "block", fontSize: "10px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "4px" }}>DAILY VALUE</span>
          <strong style={{ fontSize: "var(--font-size-xl)" }}>{formatCurrency(sub.totalPricePerDay)}</strong>
        </div>
        <div className="card-inset" style={{ textAlign: "center" }}>
          <span style={{ display: "block", fontSize: "10px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "4px" }}>DELIVERIES</span>
          <strong style={{ fontSize: "var(--font-size-xl)", color: "var(--color-primary)" }}>{totalDelivered}</strong>
        </div>
        <div className="card-inset" style={{ textAlign: "center", gridColumn: isMobile ? "span 2" : "auto" }}>
          <span style={{ display: "block", fontSize: "10px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "4px" }}>PENDING</span>
          <strong style={{ fontSize: "var(--font-size-xl)", color: sub.pendingAmount > 0 ? "var(--danger)" : "inherit" }}>{formatCurrency(sub.pendingAmount)}</strong>
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
                <strong>{sub.quantityPerDay} {sub.productId?.unit}</strong>
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
                  <StatusTag value={getHistoryStatus(d)} />
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)" }}>{getActualQuantity(d)} {sub.productId?.unit}</span>
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
                  <th>Reason</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {deliveryHistory.map((d, i) => (
                  <tr key={i}>
                    <td>{formatDate(getHistoryDate(d))}</td>
                    <td><StatusTag value={getHistoryStatus(d)} /></td>
                    <td>{getScheduledQuantity(d)} {sub.productId?.unit}</td>
                    <td>{getActualQuantity(d)} {sub.productId?.unit}</td>
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
    </div>
  );
}
