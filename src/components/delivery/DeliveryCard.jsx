import StatusTag from "../ui/StatusTag";
import { formatCurrency } from "../../utils/format";
import { Package, CheckCircle2, XCircle, SkipForward, Phone, AlertCircle } from "lucide-react";

const STATUS_ACCENT = {
  delivered: "dc-accent--delivered",
  failed:    "dc-accent--failed",
  skipped:   "dc-accent--skipped",
};

const SCHEDULE_LABEL = {
  daily:     "Daily",
  alternate: "Alt. day",
  weekly:    "Weekly",
  custom:    "Custom",
};

// ── Compact item row rendered inside a CustomerDeliveryGroup ──────────────────
function DeliveryCardGrouped({ item, onSelect, isSelected, onAction }) {
  const accentClass = STATUS_ACCENT[item.deliveryStatus] ?? "dc-accent--pending";
  const isDone = item.canRecordOutcome === false;

  const scheduleLabel = item.type === "subscription"
    ? (SCHEDULE_LABEL[item.schedule] ?? item.schedule)
    : null;

  return (
    <div className={`dc-grouped-item ${accentClass} ${isSelected ? "selected" : ""} ${isDone ? "dc-gi--done" : ""}`}>

      {/* ── Main row: indicator | product | amount + action ── */}
      <div className="dc-gi-main">

        {/* Select / done indicator */}
        {!isDone ? (
          <input
            type="checkbox"
            id={`dc-${item.id}`}
            checked={isSelected}
            onChange={() => onSelect(item.id)}
            className="dc-checkbox"
            aria-label="Select delivery"
          />
        ) : (
          <span className="dc-gi-done-dot" aria-hidden />
        )}

        {/* What to deliver */}
        <div className="dc-gi-product">
          <Package size={12} className="dc-gi-pkg-icon" />
          <span className="dc-gi-product-name">{item.productLabel}</span>
          <span className="dc-gi-qty">{item.quantity} {item.unit}</span>
          {scheduleLabel && <span className="dc-gi-schedule-chip">{scheduleLabel}</span>}
        </div>

        {/* Amount + actions */}
        <div className="dc-gi-actions">
          <span className="dc-gi-amount">{formatCurrency(item.amount)}</span>
          {item.canRecordOutcome && (
            <div className="dc-gi-btn-group">
              <button
                className="dc-gi-secondary-btn"
                onClick={() => onAction(item, item.type === "subscription" ? "skip" : "failed")}
                title={item.type === "subscription" ? "Skip this delivery" : "Mark as failed"}
              >
                {item.type === "subscription"
                  ? <SkipForward size={13} />
                  : <AlertCircle size={13} />}
              </button>
              <button
                className="dc-gi-deliver-btn"
                onClick={() => onAction(item, "delivered")}
                title="Mark as delivered"
              >
                <CheckCircle2 size={13} />
                <span>Deliver</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Meta row: type / status tags ── */}
      <div className="dc-gi-meta">
        <div className="dc-tags">
          <StatusTag value={item.type} />
          {item.deliveryStatus !== "pending" && <StatusTag value={item.deliveryStatus} />}
        </div>
        {/* Outcome detail */}
        {item.outcome && (
          <span className="dc-gi-outcome-text">
            {item.deliveryStatus === "delivered"
              ? <CheckCircle2 size={11} className="dc-outcome-icon dc-outcome-icon--ok" />
              : <XCircle size={11} className="dc-outcome-icon dc-outcome-icon--fail" />
            }
            {item.outcome.actualQuantity != null
              ? `${item.outcome.actualQuantity} ${item.unit || ""} delivered`
              : null}
            {item.outcome.reason && ` ${item.outcome.reason}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Full standalone card (used when a group contains only one item that is
//    rendered outside the group context, e.g. bulk-action fallback view) ──────
export default function DeliveryCard({ item, onSelect, isSelected, onAction, inGroup = false }) {
  if (inGroup) {
    return <DeliveryCardGrouped item={item} onSelect={onSelect} isSelected={isSelected} onAction={onAction} />;
  }

  const accentClass = STATUS_ACCENT[item.deliveryStatus] ?? "dc-accent--pending";
  const scheduleLabel = item.type === "subscription"
    ? (SCHEDULE_LABEL[item.schedule] ?? item.schedule)
    : "One-time order";

  return (
    <div className={`delivery-card dc ${accentClass} ${isSelected ? "selected" : ""}`}>

      {/* ── Row 1: identity ──────────────────────── */}
      <div className="dc-customer-row">
        {item.canRecordOutcome !== false && (
          <input
            type="checkbox"
            id={`dc-${item.id}`}
            checked={isSelected}
            onChange={() => onSelect(item.id)}
            className="dc-checkbox"
            aria-label={`Select ${item.customerName || "Unknown"}`}
          />
        )}
        <div className="dc-customer-body">
          <div className="dc-customer-name-row">
            {item.sequence != null && <span className="dc-seq-badge">#{item.sequence}</span>}
            <label htmlFor={`dc-${item.id}`} className="dc-customer-name">
              {item.customerName || "Unknown Customer"}
            </label>
          </div>
          <div className="dc-customer-contact-row">
            {item.phone && (
              <a href={`tel:${item.phone}`} className="dc-phone-link" onClick={(e) => e.stopPropagation()} title={item.phone} aria-label={`Call ${item.phone}`}>
                <Phone size={13} />
              </a>
            )}
            {!item.phone && item.email && (
              <span className="dc-customer-sub">{item.email}</span>
            )}
            {item.areaName && (
              <span className="dc-area-chip">{item.areaName}</span>
            )}
          </div>
        </div>
        <div className="dc-customer-meta">
          <span className="dc-price">{formatCurrency(item.amount)}</span>
          <div className="dc-tags">
            <StatusTag value={item.type} />
            {item.deliveryStatus !== "pending" && <StatusTag value={item.deliveryStatus} />}
          </div>
        </div>
      </div>

      {/* ── Row 2: what to deliver ───────────────── */}
      <div className="dc-delivery-row">
        <Package size={14} className="dc-info-icon" />
        <span className="dc-info-primary">{item.productLabel}</span>
        <span className="dc-qty-badge">{item.quantity} {item.unit}</span>
        <span className="dc-schedule-chip">{scheduleLabel}</span>
      </div>

      {/* ── Row 3: address ───────────────────────── */}
      {item.address && (
        <div className="dc-address-row">
          <span className="dc-address-text">{item.address}</span>
        </div>
      )}

      {/* ── Row 4: outcome ──────────────────────── */}
      {item.outcome && (
        <div className="dc-outcome">
          {item.deliveryStatus === "delivered"
            ? <CheckCircle2 size={14} className="dc-outcome-icon dc-outcome-icon--ok" />
            : <XCircle size={14} className="dc-outcome-icon dc-outcome-icon--fail" />
          }
          <span>
            {item.outcome.actualQuantity != null
              ? `${item.outcome.actualQuantity} ${item.unit || ""} delivered`
              : item.deliveryStatus}
            {item.outcome.reason && ` — ${item.outcome.reason}`}
          </span>
        </div>
      )}

      {/* ── Footer: actions ─────────────────────── */}
      {item.canRecordOutcome && (
        <div className="dc-footer-actions">
          <button
            className="dc-btn-skip"
            onClick={() => onAction(item, item.type === "subscription" ? "skip" : "failed")}
          >
            <SkipForward size={14} />
            {item.type === "subscription" ? "Skip" : "Failed"}
          </button>
          <button
            className="dc-btn-deliver"
            onClick={() => onAction(item, "delivered")}
          >
            <CheckCircle2 size={16} />
            Mark as Delivered
          </button>
        </div>
      )}

    </div>
  );
}
