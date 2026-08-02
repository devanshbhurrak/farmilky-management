import { useState } from "react";
import QuickChips from "../ui/QuickChips";

export default function OutcomeForm({ mode, scheduled, unit, form, onChange, item, subscriptions = [], subscriptionsLoading = false }) {
  const [showOther, setShowOther] = useState(false);

  const skipReasons = [
    { value: "Customer not home", label: "Not Home" },
    { value: "Requested skip", label: "Requested" },
    { value: "No response", label: "No Response" },
    { value: "other", label: "Other" }
  ];

  const failedReasons = [
    { value: "Address not found", label: "No Address" },
    { value: "Customer refused", label: "Refused" },
    { value: "Product damaged", label: "Damaged" },
    { value: "other", label: "Other" }
  ];

  const currentReasons = mode === "skip" ? skipReasons : failedReasons;

  const handleReasonSelect = (val) => {
    if (val === "other") {
      setShowOther(true);
      onChange({ reason: "" });
    } else {
      setShowOther(false);
      onChange({ reason: val });
    }
  };

  return (
    <div className="outcome-form-container">
      {(mode === "change" || mode === "delivered") && (
        <div className="form-group">
          <label>Quantity ({unit || "units"})</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.actualQuantity !== undefined ? form.actualQuantity : scheduled}
            onChange={(e) => onChange({ actualQuantity: e.target.value })}
            placeholder={`Enter quantity in ${unit || "units"}`}
            required
            autoFocus
          />
          {Number(form.actualQuantity !== undefined ? form.actualQuantity : scheduled) !== scheduled && (
            <div className="qty-helper-text">
              {Number(form.actualQuantity !== undefined ? form.actualQuantity : scheduled) > scheduled
                ? "Extra - billing will reflect the higher quantity."
                : "Partial - billing will reflect the lower quantity."}
            </div>
          )}
        </div>
      )}

      {(mode === "skip" || mode === "failed") && (
        <div className="form-group">
          <label>Select Reason</label>
          <QuickChips 
            options={currentReasons} 
            selected={showOther ? "other" : form.reason} 
            onSelect={handleReasonSelect} 
          />
          
          {(showOther || (form.reason && !currentReasons.some(r => r.value === form.reason))) && (
            <textarea
              value={form.reason || ""}
              onChange={(e) => onChange({ reason: e.target.value })}
              placeholder={mode === "skip" ? "Why skip?" : "Why failed?"}
              rows={3}
              className="reason-textarea"
              required
              autoFocus
            />
          )}
        </div>
      )}

      <div className="form-group">
        <label>Additional Notes (optional)</label>
        <textarea
          value={form.notes || ""}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Tap to add notes..."
          rows={2}
        />
      </div>

      {(mode === "delivered" || mode === "change") && item?.type === "order" && (
        <div className="form-group">
          <label>Payment Method</label>
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
              onClick={() => {
                onChange({
                  paymentMode: "subscription_ledger",
                  selectedSubscriptionId: subscriptions.length === 1 ? String(subscriptions[0]._id) : null,
                });
              }}
              title={!subscriptionsLoading && subscriptions.length === 0 ? "No active subscriptions" : ""}
            >
              Add to Subscription Ledger{subscriptionsLoading ? " …" : ""}
            </button>
          </div>

          {form.paymentMode === "subscription_ledger" && (
            <div className="outcome-sub-wrap">
              {subscriptionsLoading && (
                <p className="outcome-msg outcome-msg--muted">Loading subscriptions…</p>
              )}
              {!subscriptionsLoading && subscriptions.length === 0 && (
                <p className="outcome-msg outcome-msg--danger">No active subscriptions found.</p>
              )}
              {!subscriptionsLoading && subscriptions.length === 1 && (
                <p className="outcome-msg outcome-msg--muted">
                  Will be added to: <strong>{subscriptions[0].productName}</strong> ({subscriptions[0].deliverySchedule}) — Pending: ₹{subscriptions[0].pendingAmount}
                </p>
              )}
              {!subscriptionsLoading && subscriptions.length >= 2 && (
                <select
                  value={form.selectedSubscriptionId || ""}
                  onChange={(e) => onChange({ selectedSubscriptionId: e.target.value || null })}
                  required
                  className="outcome-sub-select"
                >
                  <option value="">— Select a subscription —</option>
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
