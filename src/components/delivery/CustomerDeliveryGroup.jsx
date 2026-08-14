import { MapPin, Phone, CheckSquare, Plus, Navigation } from "lucide-react";
import DeliveryCard from "./DeliveryCard";
import { formatCurrency } from "../../utils/format";

const hasValidCoords = (lat, lng) =>
  lat != null && lng != null && isFinite(lat) && isFinite(lng);

export default function CustomerDeliveryGroup({ group, selectedIds, onSelect, onAction, onConfirmAll, onOpenCustomerDrawer }) {
  const totalAmount = group.items.reduce((s, i) => s + (i.amount || 0), 0);
  const pendingItems = group.items.filter((i) => i.canRecordOutcome);
  const doneCount = group.items.length - pendingItems.length;
  const allDone = pendingItems.length === 0;

  const sequenceValues = group.items.map((i) => i.sequence).filter((s) => s != null);
  const sequence = sequenceValues.length > 0 ? Math.min(...sequenceValues) : null;

  const firstWithCoords = group.items.find((i) => hasValidCoords(i.lat, i.lng));
  const lat = firstWithCoords?.lat ?? null;
  const lng = firstWithCoords?.lng ?? null;
  const canNavigate = hasValidCoords(lat, lng);
  const mapsUrl = canNavigate
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : null;

  // Show address once in the header — prefer the first non-null one
  const address = group.items.find((i) => i.address)?.address ?? null;

  return (
    <div className={`customer-delivery-group cdg ${allDone ? "cdg--all-done" : ""}`}>

      {/* ── Header: all customer identity shown once ── */}
      <div className="cdg-header">
        <div className="cdg-header-top">
          <div className="cdg-header-left">
            {sequence != null && <span className="cdg-seq-badge">#{sequence}</span>}
            <span className="cdg-customer-name">{group.customerName || "Unknown Customer"}</span>
            {group.phone && (
              <a
                href={`tel:${group.phone}`}
                className="cdg-phone-link"
                onClick={(e) => e.stopPropagation()}
                title={group.phone}
                aria-label={`Call ${group.phone}`}
              >
                <Phone size={14} />
              </a>
            )}
          </div>
          <div className="cdg-header-right">
            <span className="cdg-total-amount">{formatCurrency(totalAmount)}</span>
            <div className="cdg-status-badges">
              {!allDone && pendingItems.length > 0 && (
                <span className="cdg-badge cdg-badge--pending">{pendingItems.length} pending</span>
              )}
              {doneCount > 0 && (
                <span className="cdg-badge cdg-badge--done">{doneCount} done</span>
              )}
            </div>
          </div>
        </div>

        <div className="cdg-header-meta">
          {group.areaName && (
            <span className="cdg-area-chip">
              <MapPin size={10} /> {group.areaName}
            </span>
          )}
        </div>

        {address && (
          <div className="cdg-address">
            <MapPin size={12} className="cdg-address-icon" />
            <span>{address}</span>
          </div>
        )}
      </div>

      {/* ── Items: compact rows, one per delivery ── */}
      <div className="cdg-items">
        {group.items.map((item) => (
          <DeliveryCard
            key={`${item.type}-${item.id}`}
            item={item}
            isSelected={selectedIds.has(item.id)}
            onSelect={onSelect}
            onAction={onAction}
            inGroup
          />
        ))}
      </div>

      {/* ── Footer: shared actions ── */}
      <div className="cdg-footer">
        {canNavigate && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cdg-btn-navigate"
          >
            <Navigation size={13} />
            Navigate
          </a>
        )}
        {pendingItems.length > 0 && (
          <button
            className="btn btn-primary btn-sm cdg-btn"
            onClick={() => onConfirmAll(group)}
          >
            <CheckSquare size={14} />
            Confirm All ({pendingItems.length})
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm cdg-btn"
          onClick={() => onOpenCustomerDrawer(group)}
        >
          <Plus size={14} />
          Add Extra
        </button>
      </div>
    </div>
  );
}
