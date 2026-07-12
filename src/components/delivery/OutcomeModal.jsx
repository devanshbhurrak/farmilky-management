import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import BottomSheet from "../ui/BottomSheet";
import OutcomeForm from "./OutcomeForm";
import toast from "react-hot-toast";

export default function OutcomeModal({ isMobile, outcomeModal, onClose, onConfirm, onFormChange }) {
  const [localMode, setLocalMode] = useState(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalMode(outcomeModal ? outcomeModal.mode : null); }, [outcomeModal]);

  if (!outcomeModal || !localMode) return null;

  const { item, form } = outcomeModal;
  const scheduled = item?.scheduledQuantity || item?.quantity || 0;
  const unit = item?.unit || "units";

  function handleConfirm() {
    let status, actualQuantity;

    if (localMode === "delivered" || localMode === "change") {
      const formQty = form?.actualQuantity !== undefined ? Number(form.actualQuantity) : scheduled;
      if (isNaN(formQty) || formQty < 0) {
        toast.error("Invalid quantity.");
        return;
      }
      status = formQty === scheduled ? "delivered" : (formQty > scheduled ? "extra" : "partial");
      actualQuantity = formQty;
    }
    else if (localMode === "skip") {
      status = "skipped";
      actualQuantity = 0;
    }
    else {
      status = "failed";
      actualQuantity = 0;
    }

    if ((localMode === "skip" || localMode === "failed") && !form?.reason?.trim()) {
      toast.error("Reason required.");
      return;
    }

    onConfirm({ status, actualQuantity, reason: form.reason, notes: form.notes });
  }

  const title =
    localMode === "delivered" ? "Confirm Delivery" :
    localMode === "skip" ? "Skip Delivery" :
    localMode === "failed" ? "Report Failed" : "Outcome";

  const modeOptions = [
    { value: "delivered", label: "Delivered" },
    ...(item?.type === "subscription" ? [{ value: "skip", label: "Skip" }] : []),
    { value: "failed", label: "Failed" }
  ];

  const modeSelector = (
    <div className="outcome-mode-selector" style={{ marginBottom: "var(--space-4)" }}>
      <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-bold)", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
        Delivery Outcome
      </label>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        {modeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`chip ${localMode === opt.value ? "active" : ""}`}
            style={{ flex: 1, height: "38px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: "600" }}
            onClick={() => setLocalMode(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  const formEl = (
    <>
      {modeSelector}
      <OutcomeForm
        mode={localMode}
        scheduled={scheduled}
        unit={unit}
        form={form || {}}
        onChange={onFormChange}
      />
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={!!outcomeModal} onClose={onClose} title={title}>
        {formEl}
        <button className="btn btn-primary outcome-confirm-btn" onClick={handleConfirm} style={{ width: "100%", marginTop: "var(--space-4)" }}>
          Confirm
        </button>
      </BottomSheet>
    );
  }

  return (
    <Modal
      open={!!outcomeModal}
      onClose={onClose}
      title={title}
      footer={
        <button className="btn btn-primary" onClick={handleConfirm}>Confirm</button>
      }
    >
      {formEl}
    </Modal>
  );
}