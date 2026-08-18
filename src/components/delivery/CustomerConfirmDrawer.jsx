import { useState, useEffect, useMemo } from "react";
import { Package } from "lucide-react";
import Modal from "../ui/Modal";
import BottomSheet from "../ui/BottomSheet";
import ExtraProductsSection, { validateExtraItems, makeEmptyRow } from "./ExtraProductsSection";
import { apiRequest } from "../../api/client";
import { formatCurrency } from "../../utils/format";
import toast from "react-hot-toast";

export default function CustomerConfirmDrawer({ isMobile, group, onClose, onConfirm }) {
  const [extraItems, setExtraItems] = useState([]);
  const [paymentMode, setPaymentMode] = useState("pay_at_delivery");
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  useEffect(() => {
    if (!group) return;
    setExtraItems([makeEmptyRow()]);
    setPaymentMode("pay_at_delivery");
    setSelectedSubscriptionId(null);

    const controller = new AbortController();
    const { signal } = controller;

    setSubscriptionsLoading(true);
    apiRequest(`/api/subscriptions/admin/user/${group.userId}/active`, { signal })
      .then((r) => r.json())
      .then((d) => setSubscriptions(d.subscriptions || []))
      .catch((err) => { if (err.name !== "AbortError") setSubscriptions([]); })
      .finally(() => setSubscriptionsLoading(false));

    setProductsLoading(true);
    apiRequest("/api/products", { signal })
      .then((r) => r.json())
      .then((d) => setAllProducts(d.products || []))
      .catch((err) => { if (err.name !== "AbortError") setAllProducts([]); })
      .finally(() => setProductsLoading(false));

    return () => controller.abort();
  }, [group?.userId]);

  const existingProductIds = useMemo(
    () => new Set((group?.items || []).map((i) => i.productId).filter(Boolean)),
    [group]
  );

  const filledItems = extraItems.filter((r) => r.productId);
  const extraTotal = filledItems.reduce((sum, r) => sum + Number(r.quantity || 0) * Number(r.price || 0), 0);

  function handleConfirm() {
    if (filledItems.length === 0) { toast.error("Add at least one product."); return; }
    const err = validateExtraItems(filledItems);
    if (err) { toast.error(err); return; }
    if (paymentMode === "subscription_ledger" && subscriptions.length >= 2 && !selectedSubscriptionId) {
      toast.error("Select a subscription for ledger payment.");
      return;
    }
    if (paymentMode === "subscription_ledger" && subscriptions.length === 0) {
      toast.error("No active subscriptions for this customer.");
      return;
    }
    const resolvedSubscriptionId = paymentMode === "subscription_ledger"
      ? (selectedSubscriptionId || (subscriptions.length === 1 ? String(subscriptions[0]._id) : null))
      : null;
    onConfirm({ extraItems: filledItems, paymentMode, subscriptionId: resolvedSubscriptionId });
  }

  if (!group) return null;

  const deliverySummary = (
    <div className="ccd-section">
      <p className="ccd-section-label">Today's scheduled deliveries</p>
      <div className="ccd-items-list">
        {group.items.map((item) => (
          <div key={`${item.type}-${item.id}`} className="ccd-item-row">
            <Package size={13} className="ccd-item-icon" />
            <span className="ccd-item-product">{item.productLabel}</span>
            <span className="ccd-item-qty">{item.quantity} {item.unit}</span>
            <span className={`ccd-item-status ccd-status--${item.deliveryStatus}`}>{item.deliveryStatus}</span>
            <span className="ccd-item-amount">{formatCurrency(item.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const paymentSection = filledItems.length > 0 && (
    <div className="ccd-section">
      <p className="ccd-section-label">Payment method for extra products</p>
      <div className="outcome-payment-row">
        <button
          type="button"
          className={`chip ${paymentMode === "pay_at_delivery" ? "active" : ""}`}
          onClick={() => { setPaymentMode("pay_at_delivery"); setSelectedSubscriptionId(null); }}
        >
          Pay at Delivery
        </button>
        <button
          type="button"
          className={`chip ${paymentMode === "subscription_ledger" ? "active" : ""}`}
          disabled={subscriptionsLoading || subscriptions.length === 0}
          onClick={() => {
            setPaymentMode("subscription_ledger");
            if (subscriptions.length === 1) setSelectedSubscriptionId(String(subscriptions[0]._id));
          }}
          title={!subscriptionsLoading && subscriptions.length === 0 ? "No active subscriptions" : ""}
        >
          Add to Subscription Ledger{subscriptionsLoading ? " …" : ""}
        </button>
      </div>

      {paymentMode === "subscription_ledger" && (
        <div className="outcome-sub-wrap">
          {!subscriptionsLoading && subscriptions.length === 0 && (
            <p className="outcome-msg outcome-msg--danger">No active subscriptions found for this customer.</p>
          )}
          {!subscriptionsLoading && subscriptions.length === 1 && (
            <p className="outcome-msg outcome-msg--muted">
              Will be added to: <strong>{subscriptions[0].productName}</strong> ({subscriptions[0].deliverySchedule}) — Pending: ₹{subscriptions[0].pendingAmount}
            </p>
          )}
          {!subscriptionsLoading && subscriptions.length >= 2 && (
            <select
              value={selectedSubscriptionId || ""}
              onChange={(e) => setSelectedSubscriptionId(e.target.value || null)}
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
  );

  const title = `${group.customerName} — Add Extra Products`;

  const body = (
    <div className="customer-confirm-drawer ccd">
      {deliverySummary}

      <ExtraProductsSection
        existingProductIds={existingProductIds}
        extraItems={extraItems}
        onChange={setExtraItems}
        allProducts={productsLoading ? [] : allProducts}
      />

      {paymentSection}

      {filledItems.length > 0 && (
        <div className="ccd-extra-total">
          Extra total: <strong>{formatCurrency(extraTotal)}</strong>
        </div>
      )}
    </div>
  );

  const confirmBtn = (
    <button
      className="btn btn-primary ccd-confirm-btn"
      onClick={handleConfirm}
      disabled={filledItems.length === 0}
      title={filledItems.length === 0 ? "Select at least one product to confirm" : ""}
    >
      Confirm Extra Products
    </button>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={!!group} onClose={onClose} title={title}>
        {body}
        {confirmBtn}
      </BottomSheet>
    );
  }

  return (
    <Modal
      open={!!group}
      onClose={onClose}
      title={title}
      footer={<>{confirmBtn}<button className="btn btn-ghost" onClick={onClose}>Cancel</button></>}
    >
      {body}
    </Modal>
  );
}
