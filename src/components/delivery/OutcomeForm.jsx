import { useState, useEffect } from "react";
import QuickChips from "../ui/QuickChips";

const SKIP_REASONS = [
  { value: "Customer not home", label: "Not Home" },
  { value: "Requested skip",    label: "Requested" },
  { value: "No response",       label: "No Response" },
  { value: "other",             label: "Other" },
];

const FAILED_REASONS = [
  { value: "Address not found", label: "No Address" },
  { value: "Customer refused",  label: "Refused" },
  { value: "Product damaged",   label: "Damaged" },
  { value: "other",             label: "Other" },
];

export default function OutcomeForm({
  mode, scheduled, unit, form, onChange,
  item, subscriptions = [], subscriptionsLoading = false,
}) {
  const [showOther, setShowOther] = useState(false);

  useEffect(() => { setShowOther(false); }, [mode]);

  const reasons = mode === "skip" ? SKIP_REASONS : FAILED_REASONS;

  function handleReasonSelect(val) {
    if (val === "other") {
      setShowOther(true);
      onChange({ reason: "" });
    } else {
      setShowOther(false);
      onChange({ reason: val });
    }
  }

  // qty is always pre-filled from parent; use it directly
  const currentQty = Number(form.actualQuantity ?? scheduled);
  const qtyDiff = currentQty - scheduled;

  return (
    <div className="outcome-form-container">

      {/* ── Quantity (subscriptions only) ── */}
      {(mode === "delivered" || mode === "change") && item?.type === "subscription" && (
        <div className="form-group">
          <label>Quantity delivered ({unit})</label>
          <div className="om-qty-row">
            <input
              type="number"
              min="0.1"
              step="0.1"
              className="om-qty-input"
              value={form.actualQuantity ?? scheduled}
              onChange={(e) => onChange({ actualQuantity: e.target.value })}
              autoFocus
            />
            <span className="om-qty-unit">{unit}</span>
          </div>
          {qtyDiff !== 0 && (
            <p className={`qty-helper-text ${qtyDiff > 0 ? "qty-helper--extra" : "qty-helper--partial"}`}>
              {qtyDiff > 0
                ? `+${qtyDiff} extra — billing reflects higher quantity`
                : `${qtyDiff} short — billing reflects lower quantity`}
            </p>
          )}
        </div>
      )}

      {/* ── Reason (skip / failed) ── */}
      {(mode === "skip" || mode === "failed") && (
        <div className="form-group">
          <label>Reason</label>
          <QuickChips
            options={reasons}
            selected={showOther ? "other" : form.reason}
            onSelect={handleReasonSelect}
          />
          {(showOther || (form.reason && !reasons.some((r) => r.value === form.reason))) && (
            <textarea
              className="reason-textarea"
              value={form.reason || ""}
              onChange={(e) => onChange({ reason: e.target.value })}
              placeholder={mode === "skip" ? "Describe why…" : "Describe what happened…"}
              rows={2}
              autoFocus
            />
          )}
        </div>
      )}

      {/* ── Notes (always optional) ── */}
      <div className="form-group">
        <label>Notes <span className="form-label-hint">(optional)</span></label>
        <textarea
          value={form.notes || ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Any additional notes for this delivery…"
          rows={2}
        />
      </div>

      {/* ── Payment method (orders in delivered mode only) ── */}
      {(mode === "delivered" || mode === "change") && item?.type === "order" && (
        <div className="form-group">
          <label>Payment</label>
          <div className="outcome-payment-row">
            <button
              type="button"
              className={`chip ${(!form.paymentMode || form.paymentMode === "pay_at_delivery") ? "active" : ""}`}
              onClick={() => onChange({ paymentMode: "pay_at_delivery", selectedSubscriptionId: null })}
            >
              Pay at Delivery
            </button>
            <button
              type="button"
              className={`chip ${form.paymentMode === "subscription_ledger" ? "active" : ""}`}
              disabled={subscriptionsLoading || subscriptions.length === 0}
              onClick={() =>
                onChange({
                  paymentMode: "subscription_ledger",
                  selectedSubscriptionId: subscriptions.length === 1 ? String(subscriptions[0]._id) : null,
                })
              }
              title={!subscriptionsLoading && subscriptions.length === 0 ? "No active subscriptions" : ""}
            >
              Subscription Ledger{subscriptionsLoading ? " …" : ""}
            </button>
          </div>

          {form.paymentMode === "subscription_ledger" && (
            <div className="outcome-sub-wrap">
              {subscriptionsLoading && (
                <p className="outcome-msg outcome-msg--muted">Loading subscriptions…</p>
              )}
              {!subscriptionsLoading && subscriptions.length === 0 && (
                <p className="outcome-msg outcome-msg--danger">No active subscriptions for this customer.</p>
              )}
              {!subscriptionsLoading && subscriptions.length === 1 && (
                <p className="outcome-msg outcome-msg--muted">
                  Ledger: <strong>{subscriptions[0].productName}</strong> ({subscriptions[0].deliverySchedule}) — Pending: ₹{subscriptions[0].pendingAmount}
                </p>
              )}
              {!subscriptionsLoading && subscriptions.length >= 2 && (
                <select
                  value={form.selectedSubscriptionId || ""}
                  onChange={(e) => onChange({ selectedSubscriptionId: e.target.value || null })}
                  className="outcome-sub-select"
                >
                  <option value="">— Select subscription —</option>
                  {subscriptions.map((sub) => (
                    <option key={String(sub._id)} value={String(sub._id)}>
                      {sub.productName} ({sub.deliverySchedule}) — Pending: ₹{sub.pendingAmount}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
