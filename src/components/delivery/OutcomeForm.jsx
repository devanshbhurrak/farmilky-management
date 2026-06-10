import { useState } from "react";
import QuickChips from "../ui/QuickChips";

export default function OutcomeForm({ mode, scheduled, form, onChange }) {
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
      <div className="form-group readonly">
        <label>Scheduled quantity</label>
        <div className="readonly-value">{scheduled} units</div>
      </div>

      {mode === "change" && (
        <div className="form-group">
          <label>Actual quantity delivered</label>
          <input
            type="number"
            min="1"
            step="0.1"
            value={form.actualQuantity || ""}
            onChange={(e) => onChange({ actualQuantity: e.target.value })}
            placeholder="Enter quantity"
            required
            autoFocus
          />
          <div className="qty-helper-text">
            {Number(form.actualQuantity) > scheduled
              ? "Extra - billing will reflect the higher quantity."
              : "Partial - billing will reflect the lower quantity."}
          </div>
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
    </div>
  );
}
