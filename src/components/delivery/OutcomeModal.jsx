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

  // Sync mode whenever a new modal opens (or modal closes)
  useEffect(() => {
    setLocalMode(outcomeModal ? outcomeModal.mode : null);
  }, [outcomeModal]);

  // Fetch subscriptions only for order items in delivered mode (for payment linking)
  useEffect(() => {
    if (
      outcomeModal?.item?.type === "order" &&
      localMode === "delivered" &&
      outcomeModal?.item?.userId
    ) {
      setSubscriptionsLoading(true);
      apiRequest(`/api/subscriptions/admin/user/${outcomeModal.item.userId}/active`)
        .then((res) => res.json())
        .then((d) => setSubscriptions(d.subscriptions || []))
        .catch(() => setSubscriptions([]))
        .finally(() => setSubscriptionsLoading(false));
    } else {
      setSubscriptions([]);
    }
  }, [outcomeModal?.item?.id, outcomeModal?.item?.type, outcomeModal?.item?.userId, localMode]);

  if (!outcomeModal || !localMode) return null;

  const { item, form } = outcomeModal;
  const scheduled = item?.scheduledQuantity ?? item?.quantity ?? 0;
  const unit = item?.unit || "units";

  function handleConfirm() {
    let status, actualQuantity;

    if (localMode === "delivered" || localMode === "change") {
      if (item?.type === "order") {
        // Orders: quantity is fixed; only status + payment matter
        status = "delivered";
        actualQuantity = scheduled;
      } else {
        // Subscriptions: quantity can vary
        const formQty = Number(form?.actualQuantity ?? scheduled);
        if (isNaN(formQty) || formQty < 0) {
          toast.error("Enter a valid quantity.");
          return;
        }
        if (formQty === 0) {
          toast.error("Quantity must be at least 1. Use Skip for a zero delivery.");
          return;
        }
        status = formQty === scheduled ? "delivered"
               : formQty > scheduled  ? "extra"
               : "partial";
        actualQuantity = formQty;
      }
    } else if (localMode === "skip") {
      status = "skipped";
      actualQuantity = 0;
    } else {
      // failed
      status = "failed";
      actualQuantity = 0;
    }

    if ((localMode === "skip" || localMode === "failed") && !form?.reason?.trim()) {
      toast.error("Please select a reason.");
      return;
    }

    if (
      (localMode === "delivered" || localMode === "change") &&
      item?.type === "order" &&
      form?.paymentMode === "subscription_ledger" &&
      subscriptions.length >= 2 &&
      !form?.selectedSubscriptionId
    ) {
      toast.error("Select a subscription to link this payment to.");
      return;
    }

    onConfirm({
      status,
      actualQuantity,
      reason: form?.reason || null,
      notes: form?.notes || null,
      paymentMode: form?.paymentMode || "pay_at_delivery",
      subscriptionId: form?.selectedSubscriptionId || undefined,
    });
  }

  // Item summary shown at the top of the modal
  const itemSummary = (
    <div className="om-item-summary">
      <span className="om-product-name">{item.productLabel}</span>
      <span className="om-product-qty">{scheduled} {unit}</span>
    </div>
  );

  // Mode selector tabs
  const modeOptions = [
    { value: "delivered", label: "Delivered" },
    ...(item?.type === "subscription" ? [{ value: "skip", label: "Skip" }] : []),
    { value: "failed", label: "Failed" },
  ];

  const modeSelector = (
    <div className="outcome-mode-selector">
      <span className="eyebrow">Outcome</span>
      <div className="om-mode-chips">
        {modeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`chip om-mode-chip om-mode-chip--${opt.value} ${localMode === opt.value ? "active" : ""}`}
            onClick={() => setLocalMode(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  const confirmLabel =
    localMode === "delivered" ? "Confirm Delivery" :
    localMode === "skip"      ? "Confirm Skip"     :
    localMode === "failed"    ? "Record Failure"   : "Confirm";

  const title =
    localMode === "delivered" ? `Deliver — ${item.productLabel}` :
    localMode === "skip"      ? `Skip — ${item.productLabel}`    :
    localMode === "failed"    ? `Failed — ${item.productLabel}`  :
    item.productLabel;

  const formEl = (
    <div className="om-body">
      {itemSummary}
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
    </div>
  );

  const confirmBtn = (
    <button
      className={`btn outcome-confirm-btn om-confirm-btn--${localMode}`}
      onClick={handleConfirm}
    >
      {confirmLabel}
    </button>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={!!outcomeModal} onClose={onClose} title={title}>
        {formEl}
        {confirmBtn}
      </BottomSheet>
    );
  }

  return (
    <Modal open={!!outcomeModal} onClose={onClose} title={title} footer={confirmBtn}>
      {formEl}
    </Modal>
  );
}
