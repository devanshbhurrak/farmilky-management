import Modal from "../ui/Modal";
import BottomSheet from "../ui/BottomSheet";
import OutcomeForm from "./OutcomeForm";
import toast from "react-hot-toast";

export default function OutcomeModal({ isMobile, outcomeModal, onClose, onConfirm, onFormChange }) {
  if (!outcomeModal) return null;

  const { item, mode, form } = outcomeModal;
  const scheduled = item?.scheduledQuantity || item?.quantity || 0;

  function handleConfirm() {
    let status, actualQuantity;

    if (mode === "delivered") { status = "delivered"; actualQuantity = scheduled; }
    else if (mode === "skip") { status = "skipped"; actualQuantity = 0; }
    else if (mode === "change") {
      const formQty = Number(form?.actualQuantity || 0);
      status = formQty > scheduled ? "extra" : "partial";
      actualQuantity = formQty;
    } else { status = "failed"; actualQuantity = 0; }

    if ((mode === "skip" || mode === "failed") && !form?.reason?.trim()) { toast.error("Reason required."); return; }
    if (mode === "change" && (!Number(form?.actualQuantity) || Number(form?.actualQuantity) <= 0)) { toast.error("Invalid quantity."); return; }

    onConfirm({ status, actualQuantity, reason: form.reason, notes: form.notes });
  }

  const title =
    mode === "delivered" ? "Confirm Delivery" :
    mode === "skip" ? "Skip Delivery" :
    mode === "change" ? "Change Quantity" :
    mode === "failed" ? "Report Failed" : "Outcome";

  const formEl = (
    <OutcomeForm
      mode={mode}
      scheduled={scheduled}
      form={form || {}}
      onChange={onFormChange}
    />
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={!!outcomeModal} onClose={onClose} title={title}>
        {formEl}
        <button className="btn btn-primary outcome-confirm-btn" onClick={handleConfirm}>
          Confirm Outcome
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