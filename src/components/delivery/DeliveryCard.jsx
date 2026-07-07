import StatusTag from "../ui/StatusTag";
import { formatCurrency } from "../../utils/format";

export default function DeliveryCard({ item, index, onSelect, isSelected, onAction }) {
  return (
    <div className={`delivery-card ${isSelected ? 'selected' : ''}`}>
      <div className="delivery-head">
        <div className="stop-selector">
          {item.canRecordOutcome !== false && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(item.id)}
              id={`stop-${item.id}`}
              aria-label={`Select stop ${index + 1} — ${item.customerName || "Unknown Customer"}`}
            />
          )}
          <label htmlFor={`stop-${item.id}`} className="stop-pill">Stop {index + 1}</label>
        </div>
        <div className="delivery-head-tags">
          <StatusTag value={item.type} />
          <StatusTag value={item.deliveryStatus} />
        </div>
      </div>
      
      <div className="delivery-content">
        <h4 className="customer-name">{item.customerName || "Unknown Customer"}</h4>
        <p className="customer-contact">{item.phone || item.email || "No contact info"}</p>
        
        <div className="delivery-meta-grid">
          <div className="meta-item">
            <span>Product</span>
            <strong>{item.productLabel}</strong>
          </div>
          <div className="meta-item">
            <span>Quantity</span>
            <strong>{item.quantity} {item.unit}</strong>
          </div>
          <div className="meta-item">
            <span>Schedule</span>
            <strong>{item.schedule}</strong>
          </div>
          <div className="meta-item">
            <span>Amount</span>
            <strong>{formatCurrency(item.amount)}</strong>
          </div>
        </div>
        
        {item.address && <p className="delivery-address">{item.address}</p>}
        
        {item.outcome && (
          <div className="outcome-summary">
            {item.outcome.actualQuantity != null && (
              <span>Delivered: {item.outcome.actualQuantity} {item.unit || ""}</span>
            )}
            {item.outcome.reason && <span>Reason: {item.outcome.reason}</span>}
          </div>
        )}
      </div>

      {item.canRecordOutcome && (
        <div className="delivery-actions-mobile">
          <button
            className="action-btn-primary"
            onClick={() => onAction(item, "delivered")}
          >
            Deliver
          </button>
        </div>
      )}
    </div>
  );
}
