import { todayLocal, formatCurrency } from "../../utils/format";

export default function DeliveryHistoryForm({ form, onChange, subscription, onSubmit }) {
  const today = todayLocal();

  const scheduledQty = subscription?.quantityPerDay ?? 1;
  const pricePerUnit = subscription?.totalPricePerDay != null && subscription?.quantityPerDay
    ? parseFloat((subscription.totalPricePerDay / subscription.quantityPerDay).toFixed(2))
    : null;

  const unit        = subscription?.variantUnit || subscription?.productId?.unit || "unit";
  const showQty     = form.status !== "skipped" && form.status !== "failed";
  const needsReason = form.status === "skipped" || form.status === "failed";

  // Derive status automatically from quantity when applicable
  function handleQtyChange(e) {
    const raw = e.target.value;
    const qty = Number(raw);
    let newStatus = form.status;
    if (!needsReason && raw !== "") {
      if (qty === scheduledQty) newStatus = "delivered";
      else if (qty > 0 && qty < scheduledQty) newStatus = "partial";
      else if (qty > scheduledQty) newStatus = "extra";
    }
    onChange({ actualQuantity: raw, status: newStatus });
  }

  function handleStatusChange(e) {
    const next = e.target.value;
    const wasSkipFail = needsReason;
    const isSkipFail  = next === "skipped" || next === "failed";

    let nextQty = form.actualQuantity;
    if (isSkipFail) {
      nextQty = "";                          // clear qty for skip/fail
    } else if (wasSkipFail) {
      // Switching back from skip/fail:
      // restore scheduledQty for "delivered"; clear for partial/extra so admin types actual value
      nextQty = next === "delivered" ? scheduledQty : "";
    }

    onChange({
      status: next,
      actualQuantity: nextQty,
      reason: isSkipFail ? form.reason : "",
    });
  }

  // Amount preview
  let previewAmount = null;
  if (showQty && form.actualQuantity !== "" && pricePerUnit != null) {
    previewAmount = parseFloat((Number(form.actualQuantity) * pricePerUnit).toFixed(2));
  } else if (!showQty) {
    previewAmount = 0;
  }

  return (
    <form id="delivery-history-form" onSubmit={onSubmit} className="form-stack">

      <div className="form-group">
        <label>Delivery Date <span style={{ color: "var(--danger)" }}>*</span></label>
        <input
          type="date"
          value={form.date}
          max={today}
          required
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Status <span style={{ color: "var(--danger)" }}>*</span></label>
        <select value={form.status} onChange={handleStatusChange} required>
          <option value="delivered">Delivered</option>
          <option value="partial">Partial</option>
          <option value="extra">Extra</option>
          <option value="skipped">Skipped</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {showQty && (
        <div className="form-group">
          <label>Quantity ({unit}) <span style={{ color: "var(--danger)" }}>*</span></label>
          <input
            type="number"
            value={form.actualQuantity}
            min="0.01"
            step="0.01"
            required
            placeholder={`Scheduled: ${scheduledQty}`}
            onChange={handleQtyChange}
          />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #888)", marginTop: 2 }}>
            Scheduled: {scheduledQty} {unit} · Status auto-adjusts based on quantity
          </span>
        </div>
      )}

      {needsReason && (
        <div className="form-group">
          <label>Reason <span style={{ color: "var(--danger)" }}>*</span></label>
          <input
            type="text"
            value={form.reason}
            required
            placeholder="Reason for skip / failure"
            onChange={(e) => onChange({ reason: e.target.value })}
          />
        </div>
      )}

      <div className="form-group">
        <label>Notes</label>
        <textarea
          value={form.notes}
          rows={2}
          placeholder="Optional notes"
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>

      {/* Billing summary */}
      <div style={{
        display: "flex",
        gap: 16,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--surface-2, #f9fafb)",
        border: "1px solid var(--border, #e5e7eb)",
        fontSize: "0.82rem",
        color: "var(--text-muted, #666)",
      }}>
        {pricePerUnit != null && (
          <span>Rate: <strong style={{ color: "var(--text, #111)" }}>{formatCurrency(pricePerUnit)}/{unit}</strong></span>
        )}
        {previewAmount != null ? (
          <span>
            Amount:{" "}
            <strong style={{ color: previewAmount > 0 ? "var(--text, #111)" : "var(--text-muted, #888)" }}>
              {formatCurrency(previewAmount)}
            </strong>
          </span>
        ) : (
          <span style={{ fontStyle: "italic" }}>Enter quantity to see amount</span>
        )}
      </div>

    </form>
  );
}
