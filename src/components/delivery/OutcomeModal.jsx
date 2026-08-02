import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import BottomSheet from "../ui/BottomSheet";
import OutcomeForm from "./OutcomeForm";
import toast from "react-hot-toast";
import { apiRequest } from "../../api/client";

export default function OutcomeModal({ isMobile, outcomeModal, onClose, onConfirm, onFormChange }) {
  const [localMode, setLocalMode] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalMode(outcomeModal ? outcomeModal.mode : null); }, [outcomeModal]);

  useEffect(() => {
    if (
      outcomeModal?.item?.type === "order" &&
      localMode === "delivered" &&
      outcomeModal?.item?.userId
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubscriptionsLoading(true);
      apiRequest(`/api/subscriptions/admin/user/${outcomeModal.item.userId}/active`)
        .then(async (res) => {
          const data = await res.json();
          setSubscriptions(data.subscriptions || []);
        })
        .catch(() => setSubscriptions([]))
        .finally(() => setSubscriptionsLoading(false));
    } else {
      setSubscriptions([]);
    }
  }, [outcomeModal?.item?.id, outcomeModal?.item?.type, outcomeModal?.item?.userId, localMode]);

  if (!outcomeModal || !localMode) return null;

  const { item, form } = outcomeModal;
  const scheduled = item?.scheduledQuantity || item?.quantity || 0;
  const unit = item?.unit || "units";

  function handleConfirm() {
    let status, actualQuantity;

    if (localMode === "delivered" || localMode === "change") {
      // Orders have fixed items — always "delivered"; quantity variance only applies to subscriptions
      if (item?.type === "order") {
        status = "delivered";
        actualQuantity = scheduled;
      } else {
        const formQty = form?.actualQuantity !== undefined ? Number(form.actualQuantity) : scheduled;
        if (isNaN(formQty) || formQty < 0) {
          toast.error("Invalid quantity.");
          return;
        }
        status = formQty === scheduled ? "delivered" : (formQty > scheduled ? "extra" : "partial");
        actualQuantity = formQty;
      }
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

    if (
      (localMode === "delivered" || localMode === "change") &&
      item?.type === "order" &&
      form?.paymentMode === "subscription_ledger"
    ) {
      if (subscriptions.length >= 2 && !form?.selectedSubscriptionId) {
        toast.error("Please select a subscription to link the payment to.");
        return;
      }
    }

    onConfirm({
      status,
      actualQuantity,
      reason: form.reason,
      notes: form.notes,
      paymentMode: form.paymentMode || "pay_at_delivery",
      subscriptionId: form.selectedSubscriptionId || undefined,
    });
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
    <div className="outcome-mode-selector">
      <span className="eyebrow">Delivery Outcome</span>
      <div>
        {modeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`chip ${localMode === opt.value ? "active" : ""}`}
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
        item={item}
        subscriptions={subscriptions}
        subscriptionsLoading={subscriptionsLoading}
      />
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={!!outcomeModal} onClose={onClose} title={title}>
        {formEl}
        <button className="btn btn-primary outcome-confirm-btn" onClick={handleConfirm}>
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