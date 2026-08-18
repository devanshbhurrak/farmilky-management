import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MapPin, Navigation, CheckCircle, XCircle, SkipForward, ChevronDown, ChevronUp, ArrowUp, ArrowDown, ListOrdered } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import { formatDate } from "../utils/format";
import LoadingScreen from "../components/ui/LoadingScreen";
import EmptyState from "../components/ui/EmptyState";
import StatusTag from "../components/ui/StatusTag";
import PageError from "../components/ui/PageError";
import PageHeader from "../components/ui/PageHeader";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const STATUS_ICON = {
  pending: null,
  delivered: CheckCircle,
  failed: XCircle,
  skipped: SkipForward,
};

const STATUS_COLOR = {
  pending: "var(--text-muted)",
  delivered: "var(--color-primary)",
  failed: "var(--danger)",
  skipped: "var(--warning)",
};

export default function ManifestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const { data, loading, error, refetch } = useApiData(
    createApiFetch(`/api/manifests/${id}`)
  );
  const manifest = data?.manifest;

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [actionState, setActionState] = useState({});
  const [notes, setNotes] = useState({});
  const [reason, setReason] = useState({});
  const [showCompleted, setShowCompleted] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [localOrder, setLocalOrder] = useState([]);
  const [resequencing, setResequencing] = useState(false);
  const [updatingEntries, setUpdatingEntries] = useState(new Set());

  const { pendingEntries, completedEntries } = useMemo(() => {
    if (!manifest?.entries) return { pendingEntries: [], completedEntries: [] };
    const pending = manifest.entries.filter((e) => e.status === "pending");
    const completed = manifest.entries.filter((e) => e.status !== "pending");
    return { pendingEntries: pending, completedEntries: completed };
  }, [manifest?.entries]);

  const updateEntry = async (entryId, status) => {
    if (updatingEntries.has(entryId)) return;
    if (status === "failed" && !reason[entryId]?.trim()) {
      toast.error("Please enter a failure reason.");
      return;
    }
    setUpdatingEntries((prev) => new Set(prev).add(entryId));
    try {
      const res = await apiRequest(`/api/manifests/${id}/entries/${entryId}`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          deliveryNotes: notes[entryId] || null,
          failureReason: status === "failed" ? (reason[entryId] || null) : null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message);
      toast.success(`Marked as ${status}.`);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to update.");
    } finally {
      setUpdatingEntries((prev) => { const next = new Set(prev); next.delete(entryId); return next; });
    }
  };

  const startReorder = () => {
    setLocalOrder(pendingEntries.map((e) => e._id));
    setReorderMode(true);
  };

  const moveEntry = (index, delta) => {
    setLocalOrder((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveResequence = async () => {
    setResequencing(true);
    try {
      const res = await apiRequest(`/api/manifests/${id}/resequence`, {
        method: "PUT",
        body: JSON.stringify({ orderedEntryIds: localOrder }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message);
      toast.success("Route order saved.");
      setReorderMode(false);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to save order.");
    } finally {
      setResequencing(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error || !manifest) return (
    <div className="view-stack">
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>
      <PageError message={error || "Manifest not found."} onRetry={refetch} />
    </div>
  );

  const pct = manifest.summary?.total
    ? Math.round(((manifest.summary.delivered + manifest.summary.failed) / manifest.summary.total) * 100)
    : 0;

  return (
    <div className="view-stack manifest-detail-page">
      <PageHeader
        title={manifest.areaId?.name || "Delivery Manifest"}
        subtitle={`${formatDate(manifest.date)} • Agent: ${manifest.agentId?.name || "Unknown"}`}
        breadcrumb={[
          { label: "Manifests", path: isAdmin ? "/manifests" : "/agent" },
          { label: manifest.areaId?.name || "Manifest" }
        ]}
        actions={
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(isAdmin ? "/manifests" : "/agent")}
          >
            <ArrowLeft size={16} />
            {isMobile ? "Back" : "Back to Manifests"}
          </button>
        }
      />

      <section className="panel manifest-progress-panel">
        <div className="manifest-progress-head">
          <p className="eyebrow">Route Progress</p>
          <StatusTag value={manifest.status === "completed" ? "delivered" : manifest.status === "paused" ? "paused" : "active"} />
        </div>

        <div className="manifest-stats-grid">
          <div className="card-inset manifest-stat">
            <span className="manifest-stat-label">TOTAL</span>
            <strong className="manifest-stat-value">{manifest.summary?.total}</strong>
          </div>
          <div className="card-inset manifest-stat">
            <span className="manifest-stat-label">DONE</span>
            <strong className="manifest-stat-value done">{manifest.summary?.delivered}</strong>
          </div>
          <div className="card-inset manifest-stat">
            <span className="manifest-stat-label">FAIL</span>
            <strong className="manifest-stat-value fail">{manifest.summary?.failed}</strong>
          </div>
          <div className="card-inset manifest-stat">
            <span className="manifest-stat-label">LEFT</span>
            <strong className="manifest-stat-value">{manifest.summary?.pending}</strong>
          </div>
        </div>

        <div className="manifest-detail-track">
          <div className="manifest-detail-bar" style={{ width: `${pct}%` }} />
        </div>
        <p className="manifest-detail-pct">{pct}% COMPLETE</p>
      </section>

      {renderEntryList()}
    </div>
  );

  function renderEntryCard(entry, isNextStop = false, orderIndex = null) {
    const IconComp = STATUS_ICON[entry.status];
    const isExpanded = actionState[entry._id] || isNextStop;
    const isUpdating = updatingEntries.has(entry._id);

    return (
      <div
        key={entry._id}
        className={`manifest-entry${isNextStop && entry.status === "pending" ? " next-stop" : ""}`}
        style={{ borderLeftColor: STATUS_COLOR[entry.status] }}
      >
        <div className="manifest-entry-layout">
          <div className="manifest-entry-info">
            <div className="manifest-entry-name-row">
              {IconComp && <IconComp size={18} style={{ color: STATUS_COLOR[entry.status] }} />}
              {isNextStop && entry.status === "pending" && (
                <span className="manifest-next-badge">NEXT STOP</span>
              )}
              {entry.sequence != null && (
                <span className="manifest-seq-badge">#{entry.sequence}</span>
              )}
              <strong className="manifest-entry-name">{entry.customerName}</strong>
              <StatusTag value={entry.status} />
            </div>
            <p className="manifest-entry-product">{entry.productLabel}</p>
            {entry.address && (
              <div className="manifest-entry-address">
                <MapPin size={14} />
                <span>{entry.address}</span>
              </div>
            )}
          </div>

          <div className="manifest-entry-side">
            {(() => {
              const hasGPS = entry.lat != null && entry.lng != null && isFinite(entry.lat) && isFinite(entry.lng);
              if (!hasGPS && !entry.address) return null;
              return (
                <a
                  href={
                    hasGPS
                      ? `https://www.google.com/maps/dir/?api=1&destination=${entry.lat},${entry.lng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.address)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  title={hasGPS ? "Navigate (GPS)" : "Open Map"}
                >
                  <Navigation size={16} />
                </a>
              );
            })()}
            {entry.phone && (
              <a href={`tel:${entry.phone}`} className="btn btn-secondary btn-sm" title="Call Customer">
                <Phone size={16} />
              </a>
            )}
            {entry.status === "pending" && reorderMode ? (
              <div className="reorder-controls">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={orderIndex === 0}
                  onClick={() => moveEntry(orderIndex, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={orderIndex === localOrder.length - 1}
                  onClick={() => moveEntry(orderIndex, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            ) : entry.status === "pending" && !isNextStop ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActionState((p) => ({ ...p, [entry._id]: !p[entry._id] }))}
              >
                {isExpanded ? "Close" : "Update"}
              </button>
            ) : null}
          </div>
        </div>

        {entry.status === "pending" && isExpanded && !reorderMode && (
          <div className="manifest-action-form">
            <div className="form-group">
              <label>Delivery Notes</label>
              <textarea
                placeholder="Gate code, doorbell info, etc..."
                rows={2}
                value={notes[entry._id] || ""}
                onChange={(e) => setNotes((p) => ({ ...p, [entry._id]: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Failure Reason (Required for Failed)</label>
              <input
                placeholder="e.g. Customer out of town"
                value={reason[entry._id] || ""}
                onChange={(e) => setReason((p) => ({ ...p, [entry._id]: e.target.value }))}
              />
            </div>
            <div className="manifest-action-buttons">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => updateEntry(entry._id, "delivered")}
                disabled={isUpdating}
              >
                {isUpdating ? "Saving…" : "Mark Delivered"}
              </button>
              <button
                className="btn btn-secondary btn-sm danger"
                disabled={isUpdating}
                onClick={() => {
                  if (!reason[entry._id]?.trim()) {
                    toast.error("Please enter a failure reason.");
                    return;
                  }
                  updateEntry(entry._id, "failed");
                }}
              >
                Mark Failed
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => updateEntry(entry._id, "skipped")}
                disabled={isUpdating}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {(entry.failureReason || entry.deliveryNotes) && (
          <div className="manifest-entry-footer">
            {entry.failureReason && (
              <p className="manifest-entry-reason"><strong>REASON:</strong> {entry.failureReason}</p>
            )}
            {entry.deliveryNotes && (
              <p className="manifest-entry-notes"><strong>NOTES:</strong> {entry.deliveryNotes}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderEntryList() {
    const pendingOrdered = reorderMode
      ? localOrder.map((entryId) => pendingEntries.find((e) => e._id === entryId)).filter(Boolean)
      : pendingEntries;

    return (
      <div>
        <div className="manifest-queue-row">
          <p className="eyebrow manifest-queue-heading">Queue ({pendingEntries.length})</p>
          {isAdmin && pendingEntries.length > 1 && !reorderMode && (
            <button className="btn btn-secondary btn-sm" onClick={startReorder} title="Reorder pending stops">
              <ListOrdered size={16} /> Edit Order
            </button>
          )}
          {isAdmin && reorderMode && (
            <div className="resequence-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setReorderMode(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveResequence} disabled={resequencing}>
                {resequencing ? "Saving…" : "Save Order"}
              </button>
            </div>
          )}
        </div>
        {pendingOrdered.length === 0 ? (
          <EmptyState text="No pending stops left! High five." icon={CheckCircle} />
        ) : (
          <div className="manifest-entry-list">
            {pendingOrdered.map((entry, i) => renderEntryCard(entry, i === 0, reorderMode ? i : null))}
          </div>
        )}

        {completedEntries.length > 0 && (
          <div>
            <button
              type="button"
              className="btn btn-secondary manifest-completed-toggle"
              onClick={() => setShowCompleted((v) => !v)}
            >
              {showCompleted ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              <span>{showCompleted ? "Hide" : "Show"} Completed ({completedEntries.length})</span>
            </button>
            {showCompleted && (
              <div className="manifest-completed-list">
                {completedEntries.map((entry) => renderEntryCard(entry))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
