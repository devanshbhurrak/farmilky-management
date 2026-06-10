import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MapPin, CheckCircle, XCircle, SkipForward, ChevronDown, ChevronUp } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import { formatDate } from "../utils/format";
import LoadingScreen from "../components/ui/LoadingScreen";
import EmptyState from "../components/ui/EmptyState";
import StatusTag from "../components/ui/StatusTag";
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

  const { pendingEntries, completedEntries } = useMemo(() => {
    if (!manifest?.entries) return { pendingEntries: [], completedEntries: [] };
    const pending = manifest.entries.filter((e) => e.status === "pending");
    const completed = manifest.entries.filter((e) => e.status !== "pending");
    return { pendingEntries: pending, completedEntries: completed };
  }, [manifest?.entries]);

  const updateEntry = async (entryId, status) => {
    if (status === "failed" && !reason[entryId]?.trim()) {
      toast.error("Please enter a failure reason.");
      return;
    }
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
    }
  };

  if (loading) return <LoadingScreen />;
  if (error || !manifest) return (
    <div className="view-stack">
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className="page-error">{error || "Manifest not found."}</div>
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
          <StatusTag value={manifest.status === "completed" ? "delivered" : "active"} />
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

  function renderEntryCard(entry, isNextStop = false) {
    const IconComp = STATUS_ICON[entry.status];
    const isExpanded = actionState[entry._id] || isNextStop;

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
            {entry.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                title="Open Map"
              >
                <MapPin size={16} />
              </a>
            )}
            {entry.phone && (
              <a href={`tel:${entry.phone}`} className="btn btn-secondary btn-sm" title="Call Customer">
                <Phone size={16} />
              </a>
            )}
            {entry.status === "pending" && !isNextStop && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActionState((p) => ({ ...p, [entry._id]: !p[entry._id] }))}
              >
                {isExpanded ? "Close" : "Update"}
              </button>
            )}
          </div>
        </div>

        {entry.status === "pending" && isExpanded && (
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
              >
                Mark Delivered
              </button>
              <button
                className="btn btn-secondary btn-sm danger"
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
    return (
      <div>
        <p className="eyebrow manifest-queue-heading">Queue ({pendingEntries.length})</p>
        {pendingEntries.length === 0 ? (
          <EmptyState text="No pending stops left! High five." icon={CheckCircle} />
        ) : (
          <div className="manifest-entry-list">
            {pendingEntries.map((entry, i) => renderEntryCard(entry, i === 0))}
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
