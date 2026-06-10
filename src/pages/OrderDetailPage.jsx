import { ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiRequest, safeParseJson } from "../api/client";
import { formatCurrency, formatDate, formatTime } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageSkeleton from "../components/ui/PageSkeleton";
import EmptyState from "../components/ui/EmptyState";
import StickyActionBar from "../components/ui/StickyActionBar";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/order/admin/${id}`);
      if (res.status === 401) { navigate("/login"); return; }
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed to load order"); }
      const data = await res.json();
      setOrder(data.order || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  async function handleStatusUpdate(status) {
    setStatusLoading(true);
    try {
      const res = await apiRequest(`/api/order/admin/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Update failed"); }
      toast.success(`Order updated to ${status}.`);
      await fetchOrder();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStatusLoading(false);
    }
  }

  if (loading) return <PageSkeleton />;
  if (error) return <EmptyState text={error} action={{ label: "Retry", onClick: fetchOrder }} />;
  if (!order) return <EmptyState text="Order not found." />;

  const statusTimeline = [
    { label: "Placed", date: order.createdAt },
    { label: "Confirmed", date: order.orderStatus === "confirmed" || order.orderStatus === "delivered" ? order.createdAt : null },
    { label: "Delivered", date: order.deliveredAt },
    { label: "Cancelled", date: order.cancelledAt },
  ].filter((s) => s.date);

  const actionButtons = (
    <>
      {order.orderStatus === "placed" && (
        <button className="primary-button" onClick={() => handleStatusUpdate("confirmed")} disabled={statusLoading}>
          Confirm Order
        </button>
      )}
      {(order.orderStatus === "placed" || order.orderStatus === "confirmed") && (
        <button className="primary-button" onClick={() => handleStatusUpdate("delivered")} disabled={statusLoading}>
          Mark Delivered
        </button>
      )}
      {(order.orderStatus === "placed" || order.orderStatus === "confirmed") && (
        <button className="danger-button" onClick={() => setCancelConfirm(true)} disabled={statusLoading}>
          Cancel Order
        </button>
      )}
    </>
  );

  return (
    <div className="view-stack">
      <PageHeader
        title={`Order #${order._id?.slice(-8).toUpperCase()}`}
        subtitle={`${order.userId?.name || "Unknown"} · Placed ${formatDate(order.createdAt)} at ${formatTime(order.createdAt)}`}
        breadcrumb={[
          { label: "Orders", path: "/orders" },
          { label: `#${order._id?.slice(-8).toUpperCase()}` }
        ]}
        actions={
          <div className="detail-actions">
            <StatusTag value={order.orderStatus} />
            <div className="detail-actions-buttons">{actionButtons}</div>
          </div>
        }
      />

      <div className="two-column-grid">
        <div className="view-stack">
          <section className="panel">
            <p className="eyebrow">Customer</p>
            <h4 style={{ marginTop: "0.5rem" }}>
              {order.userId?._id ? (
                <Link to={`/customers/${order.userId._id}`}>{order.userId?.name || "Unknown"}</Link>
              ) : (
                order.userId?.name || "Unknown"
              )}
            </h4>
            <p style={{ fontSize: "0.95rem" }}>{order.userId?.email}</p>
            <p style={{ fontSize: "0.95rem" }}>{order.userId?.phone}</p>
          </section>

          <section className="panel">
            <p className="eyebrow">Delivery Address</p>
            <p style={{ marginTop: "0.5rem", fontSize: "0.95rem", lineHeight: "1.5" }}>
              {order.address ? (
                `${order.address.street}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}`
              ) : (
                "No address provided"
              )}
            </p>
          </section>

          <section className="panel">
            <p className="eyebrow">Payment</p>
            <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.5rem" }}>
              <p>Method: <strong>{order.paymentMethod}</strong></p>
              <p>Status: <StatusTag value={order.paymentStatus} /></p>
              {order.transactionId && <p>Transaction: <code>{order.transactionId}</code></p>}
              <p>Amount: <strong style={{ fontSize: "1.2rem", color: "var(--color-primary-dark)" }}>{formatCurrency(order.totalAmount)}</strong></p>
            </div>
          </section>
        </div>

        <div className="view-stack">
          <section className="panel">
            <p className="eyebrow">Items</p>
            <div className="stack-list" style={{ marginTop: "0.5rem" }}>
              {(order.items || []).map((item, i) => (
                <div className="list-card" key={i}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.quantity} x {formatCurrency(item.price)}</span>
                  </div>
                  <div className="card-figure">
                    <strong>{formatCurrency((item.price || 0) * (item.quantity || 0))}</strong>
                  </div>
                </div>
              ))}
            </div>
            <div className="list-card bold-card" style={{ marginTop: "0.75rem", borderTop: "2px solid var(--surface-inset)", paddingTop: "0.75rem" }}>
              <div><strong>Total</strong></div>
              <div className="card-figure"><strong>{formatCurrency(order.totalAmount)}</strong></div>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Timeline</p>
            <div className="stack-list" style={{ marginTop: "0.5rem" }}>
              {statusTimeline.map((s, i) => (
                <div className="list-card" key={i}>
                  <div><strong>{s.label}</strong></div>
                  <div className="card-figure">
                    <span>{s.date ? formatDate(s.date) : "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {!isMobile && order.orderStatus !== "delivered" && order.orderStatus !== "cancelled" && (
            <section className="panel">
              <p className="eyebrow">Actions</p>
              <div className="action-row" style={{ marginTop: "1rem" }}>
                {actionButtons}
              </div>
            </section>
          )}
        </div>
      </div>

      <StickyActionBar visible={isMobile && order.orderStatus !== "delivered" && order.orderStatus !== "cancelled"}>
        {actionButtons}
      </StickyActionBar>

      <ConfirmDialog
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={async () => {
          await handleStatusUpdate("cancelled");
          setCancelConfirm(false);
        }}
        title="Cancel Order"
        message={`Are you sure you want to cancel order #${order._id?.slice(-8)}? This action cannot be undone.`}
        confirmText="Cancel Order"
        loading={statusLoading}
      />
    </div>
  );
}
