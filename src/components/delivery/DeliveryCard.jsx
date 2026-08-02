import StatusTag from "../ui/StatusTag";
import { formatCurrency } from "../../utils/format";
import { Package, Clock, MapPin, CheckCircle2, XCircle } from "lucide-react";

const STATUS_ACCENT = {
  delivered: "dc-accent--delivered",
  failed:    "dc-accent--failed",
  skipped:   "dc-accent--skipped",
};

export default function DeliveryCard({ item, onSelect, isSelected, onAction }) {
  const accentClass = STATUS_ACCENT[item.deliveryStatus] ?? "dc-accent--pending";

  return (
    <div className={`delivery-card dc ${accentClass} ${isSelected ? "selected" : ""}`}>

      {/* ── Section 1: customer ───────────────────── */}
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
          <label htmlFor={`dc-${item.id}`} className="dc-customer-name">
            {item.customerName || "Unknown Customer"}
          </label>
          {(item.phone || item.email) && (
            <span className="dc-customer-sub">{item.phone || item.email}</span>
          )}
        </div>
        <div className="dc-customer-meta">
          <span className="dc-price">{formatCurrency(item.amount)}</span>
          <div className="dc-tags">
            <StatusTag value={item.type} />
            {item.deliveryStatus !== "pending" && <StatusTag value={item.deliveryStatus} />}
          </div>
        </div>
      </div>

      {/* ── Section 2: delivery info ──────────────── */}
      <div className="dc-info">
        <div className="dc-info-row">
          <Package size={14} className="dc-info-icon" />
          <span className="dc-info-primary">{item.productLabel}</span>
          <span className="dc-info-sep">·</span>
          <span className="dc-info-secondary">{item.quantity} {item.unit}</span>
          <span className="dc-info-sep">·</span>
          <Clock size={11} className="dc-info-icon" />
          <span className="dc-info-secondary">{item.schedule}</span>
        </div>
        {item.address && (
          <div className="dc-info-row dc-info-address">
            <MapPin size={14} className="dc-info-icon" />
            <span className="dc-info-secondary">{item.address}</span>
          </div>
        )}
      </div>

      {/* ── Section 3: outcome + action ──────────── */}
      {(item.outcome || item.canRecordOutcome) && (
        <div className="dc-footer">
          {item.outcome && (
            <div className="dc-outcome">
              {item.deliveryStatus === "delivered"
                ? <CheckCircle2 size={14} className="dc-outcome-icon dc-outcome-icon--ok" />
                : <XCircle size={14} className="dc-outcome-icon dc-outcome-icon--fail" />
              }
              <span>
                {item.outcome.actualQuantity != null && `${item.outcome.actualQuantity} ${item.unit || ""} delivered`}
                {item.outcome.reason && ` · ${item.outcome.reason}`}
              </span>
            </div>
          )}
          {item.canRecordOutcome && (
            <button
              className="dc-btn-deliver"
              onClick={() => onAction(item, "delivered")}
            >
              Mark as Delivered
            </button>
          )}
        </div>
      )}

    </div>
  );
}
