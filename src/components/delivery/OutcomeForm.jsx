import { useState } from "react";
import QuickChips from "../ui/QuickChips";

export default function OutcomeForm({ mode, scheduled, unit, form, onChange }) {
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
    </div>
  );
}
