import { ChevronRight, Plus, ShoppingBag, Calendar, Edit2 } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiRequest, safeParseJson } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageHeader from "../components/ui/PageHeader";
import PageSkeleton from "../components/ui/PageSkeleton";
import EmptyState from "../components/ui/EmptyState";
import DataTable from "../components/ui/DataTable";
import Modal from "../components/ui/Modal";
import BottomSheet from "../components/ui/BottomSheet";
import SubscriptionForm from "../components/subscription/SubscriptionForm";
import OrderForm from "../components/order/OrderForm";
import CustomerForm from "../components/customer/CustomerForm";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("ledger");
  const [historyModal, setHistoryModal] = useState(null); // Used for viewing payment details if needed
  const [passbook, setPassbook] = useState({ user: {}, entries: [] });
  const [passbookLoading, setPassbookLoading] = useState(false);

  const [modalType, setModalType] = useState(null); // 'subscription' | 'order' | 'customer' | 'payment'
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/user/admin/${id}`);
      if (res.status === 401) return;
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed to load customer"); }
      const data = await res.json();
      setCustomer(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchPassbook = useCallback(async () => {
    setPassbookLoading(true);
    try {
      const res = await apiRequest(`/api/payments/${id}`);
      if (!res.ok) throw new Error("Failed to fetch passbook");
      const data = await res.json();
      setPassbook(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPassbookLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);
  useEffect(() => { if (tab === "ledger") fetchPassbook(); }, [tab, fetchPassbook]);

  useEffect(() => {
    if (modalType === 'subscription' || modalType === 'order') {
      apiRequest("/api/products")
        .then(r => r.json())
        .then(data => setProducts(data.products || data || []))
        .catch(() => toast.error("Failed to load products"));
    }
  }, [modalType]);

  if (loading) return <PageSkeleton />;
  if (error) return <EmptyState text={error} action={{ label: "Retry", onClick: fetchCustomer }} />;
  if (!customer) return <EmptyState text="Customer not found." />;

  const user = customer.user || customer;
  const orders = customer.recentOrders || [];
  const subscriptions = customer.subscriptions || [];

  function openEditCustomer() {
    setForm({ 
      ...user, 
      address: user.addresses?.[0] || { street: "", city: "", state: "", pincode: "" },
      password: "" 
    });
    setModalType("customer");
  }

  function openAddSubscription() {
    setForm({ 
      userId: id, 
      productId: "", 
      quantityPerDay: 1, 
      deliverySchedule: "daily", 
      customDays: [], 
      startDate: new Date().toISOString().split("T")[0] 
    });
    setModalType("subscription");
  }

  function openAddOrder() {
    setForm({ 
      userId: id, 
      items: [{ productId: "", quantity: 1 }], 
      address: user?.addresses?.[0] || { street: "", city: "", state: "", pincode: "" }, 
      paymentMethod: "COD", 
      paymentStatus: "pending", 
      orderStatus: "confirmed" 
    });
    setModalType("order");
  }

  function openAddPayment() {
    setForm({
      userId: id,
      amount: "",
      transactionId: "",
      notes: "",
      date: new Date().toISOString().split("T")[0]
    });
    setModalType("payment");
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      let endpoint, method;
      if (modalType === "subscription") {
        endpoint = "/api/subscriptions/admin/create";
        method = "POST";
      } else if (modalType === "order") {
        endpoint = "/api/order/admin/create";
        method = "POST";
      } else if (modalType === "customer") {
        endpoint = `/api/user/admin/${id}`;
        method = "PUT";
      } else if (modalType === "payment") {
        endpoint = "/api/payments/admin/record";
        method = "POST";
      }
      
      const body = modalType === "customer" 
        ? { ...form, addresses: form.address.street ? [form.address] : [] }
        : form;

      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(body),
      });
      const payload = await safeParseJson(res);
      if (!res.ok) throw new Error(payload?.message || `Failed to save ${modalType}`);
      
      toast.success(`${modalType.charAt(0).toUpperCase() + modalType.slice(1)} saved!`);
      setModalType(null);
      fetchCustomer();
      if (modalType === "payment") fetchPassbook();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const orderColumns = [
    { key: "_id", label: "Order ID", render: (r) => <code>#{r._id?.slice(-8)}</code> },
    { key: "totalAmount", label: "Amount", render: (r) => formatCurrency(r.totalAmount) },
    { key: "orderStatus", label: "Status", render: (r) => <StatusTag value={r.orderStatus} /> },
    { key: "createdAt", label: "Date", render: (r) => formatDate(r.createdAt) },
  ];

  const renderOrderCard = (order) => (
    <div className="sub-table-card">
      <div className="st-card-header">
        <code>#{order._id?.slice(-8)}</code>
        <StatusTag value={order.orderStatus} />
      </div>
      <div className="st-card-body">
        <strong>{formatCurrency(order.totalAmount)}</strong>
        <span>{formatDate(order.createdAt)}</span>
      </div>
    </div>
  );

  const subColumns = [
    { key: "productId.name", label: "Product" },
    { key: "quantityPerDay", label: "Qty/Day" },
    { key: "totalPricePerDay", label: "Daily Value", render: (r) => formatCurrency(r.totalPricePerDay) },
    { key: "status", label: "Status", render: (r) => <StatusTag value={r.status} /> },
  ];

  const renderSubCard = (sub) => (
    <div className="sub-table-card">
      <div className="st-card-header">
        <strong>{sub.productId?.name || "Product"}</strong>
        <StatusTag value={sub.status} />
      </div>
      <div className="st-card-body">
        <span>{sub.quantityPerDay} per day</span>
        <strong>{formatCurrency(sub.totalPricePerDay)}</strong>
      </div>
    </div>
  );

  const invoiceColumns = [
    { key: "_id", label: "Invoice", render: (r) => <code>#{r._id?.slice(-8)}</code> },
    { key: "month", label: "Month" },
    { key: "totalAmount", label: "Amount", render: (r) => formatCurrency(r.totalAmount) },
    { 
      key: "remainingAmount", 
      label: "Remaining", 
      render: (r) => {
        const remaining = Math.max(0, r.totalAmount - (r.amountPaid || 0));
        return <span className={remaining > 0 ? "danger-text" : ""}>{formatCurrency(remaining)}</span>;
      }
    },
    { key: "status", label: "Status", render: (r) => <StatusTag value={r.status} /> },
    {
      key: "_actions",
      label: "History",
      render: (r) => (r.amountPaid > 0 || r.payments?.length > 0) ? (
        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setHistoryModal(r); }}>
          View
        </button>
      ) : "—"
    }
  ];

  const renderInvoiceCard = (inv) => (
    <div className="sub-table-card">
      <div className="st-card-header">
        <strong>{inv.month}</strong>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {(inv.amountPaid > 0 || inv.payments?.length > 0) && (
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setHistoryModal(inv); }}>
              History
            </button>
          )}
          <StatusTag value={inv.status} />
        </div>
      </div>
      <div className="st-card-body">
        <span>Remaining: <strong className={(inv.totalAmount - (inv.amountPaid || 0)) > 0 ? "danger-text" : ""}>{formatCurrency(Math.max(0, inv.totalAmount - (inv.amountPaid || 0)))}</strong></span>
        <strong>Total: {formatCurrency(inv.totalAmount)}</strong>
      </div>
    </div>
  );

  const paymentColumns = [
    { key: "date", label: "Date", render: (r) => formatDate(r.date) },
    { key: "amount", label: "Amount", render: (r) => <strong>{formatCurrency(r.amount)}</strong> },
    { key: "invoiceMonth", label: "Invoice", render: (r) => r.invoiceMonth },
    { key: "transactionId", label: "Ref", render: (r) => r.transactionId || (r.isLegacy ? "Legacy" : "—") },
    { key: "recordedBy.name", label: "Recorded By", render: (r) => r.recordedBy?.name || "—" },
  ];

  const renderPaymentCard = (p) => (
    <div className="sub-table-card">
      <div className="st-card-header">
        <strong>{formatCurrency(p.amount)}</strong>
        <span className="text-muted">{formatDate(p.date)}</span>
      </div>
      <div className="st-card-body">
        <span>Invoice: {p.invoiceMonth}</span>
        <span>{p.transactionId ? `Ref: ${p.transactionId}` : p.isLegacy ? "Legacy Payment" : ""}</span>
      </div>
    </div>
  );

  return (
    <div className="view-stack">
      <PageHeader 
        title={user.name}
        subtitle={`${user.email} · ${user.phone || "No phone"}`}
        breadcrumb={[
          { label: "Customers", path: "/customers" },
          { label: user.name }
        ]}
        actions={
          <div className="detail-actions">
            <StatusTag value={user.role} />
            <div className="detail-actions-buttons">
              <button className="btn btn-secondary btn-sm" onClick={openEditCustomer}>
                <Edit2 size={14} /> Edit Profile
              </button>
              <button className="btn btn-secondary btn-sm" onClick={openAddSubscription}>
                <Calendar size={14} /> Add Sub
              </button>
              <button className="btn btn-primary btn-sm" onClick={openAddPayment}>
                Rs Collect Payment
              </button>
            </div>
          </div>
        }
      />

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: "var(--space-1)" }}>Customer Since</p>
            <strong>{formatDate(user.createdAt)}</strong>
          </div>
          <span className="info-chip" style={{ background: "var(--surface-muted)", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-pill)", fontSize: "var(--font-size-xs)", fontWeight: "bold" }}>
            ID: #{user._id?.slice(-6).toUpperCase()}
          </span>
        </div>
        
        {user.addresses?.length > 0 && (
          <div className="customer-addresses" style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--border-soft)" }}>
            <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Saved Addresses</p>
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              {user.addresses.map((addr, i) => (
                <div key={i} className="list-card" style={{ background: "var(--surface-muted)", boxShadow: "none" }}>
                  <div>
                    <strong>{addr.type}</strong>
                    <span>{addr.street}, {addr.city}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "var(--font-size-sm)", color: "var(--text-muted)" }}>
                    {addr.state} - {addr.pincode}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={isMobile ? "mobile-metric-strip" : "card-grid"}>
        <div className="panel info-card">
          <p className="eyebrow">Current Balance</p>
          <strong className={user.accountBalance > 0 ? "danger-text" : "success-text"}>
            {formatCurrency(user.accountBalance)}
          </strong>
        </div>
        <div className="panel info-card">
          <p className="eyebrow">Deliveries</p>
          <strong>{subscriptions.reduce((s, sub) => s + (sub.deliveryHistory?.length || 0), 0)}</strong>
        </div>
        <div className="panel info-card">
          <p className="eyebrow">Total Orders</p>
          <strong>{orders.length}</strong>
        </div>
      </div>

      <section className="panel detail-tabs-panel">
        <div className="scrollable-tab-bar">
          {["ledger", "orders", "subscriptions"].map((t) => (
            <button
              key={t}
              className={tab === t ? "tab-pill active" : "tab-pill"}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="tab-content" style={{ marginTop: "1.5rem" }}>
          {tab === "ledger" && (
            <DataTable 
              columns={[
                { key: "date", label: "Date", render: (r) => formatDate(r.date) },
                { key: "description", label: "Description", render: (r) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.description}</div>
                    <div className="text-muted" style={{ fontSize: '11px' }}>{r.notes}</div>
                  </div>
                )},
                { key: "debit", label: "Debit", render: (r) => r.type === "debit" ? <span className="danger-text">-{formatCurrency(r.amount)}</span> : "—" },
                { key: "credit", label: "Credit", render: (r) => r.type === "credit" ? <span className="success-text">+{formatCurrency(r.amount)}</span> : "—" },
              ]} 
              data={passbook.entries} 
              renderCard={(r) => (
                <div className="sub-table-card">
                  <div className="st-card-header">
                    <strong>{r.description}</strong>
                    <span className={r.type === "debit" ? "danger-text" : "success-text"}>
                      {r.type === "debit" ? "-" : "+"}{formatCurrency(r.amount)}
                    </span>
                  </div>
                  <div className="st-card-body">
                    <span>{formatDate(r.date)}</span>
                    <span className="text-muted">{r.notes}</span>
                  </div>
                </div>
              )} 
              emptyText="No transactions found." 
              pageSize={20} 
              isLoading={passbookLoading}
            />
          )}
          {tab === "orders" && (
            <DataTable 
              columns={orderColumns} 
              data={orders} 
              renderCard={renderOrderCard} 
              emptyText="No orders yet." 
              pageSize={10} 
              onRowClick={(row) => navigate(`/orders/${row._id}`)}
            />
          )}
          {tab === "subscriptions" && (
            <DataTable 
              columns={subColumns} 
              data={subscriptions} 
              renderCard={renderSubCard}
              emptyText="No subscriptions yet." 
              pageSize={10} 
              onRowClick={(row) => navigate(`/subscriptions/${row._id}`)}
            />
          )}
        </div>
      </section>

      {isMobile ? (
        <BottomSheet
          isOpen={!!modalType}
          onClose={() => setModalType(null)}
          title={modalType === 'customer' ? "Edit Customer" : modalType === 'subscription' ? "Add Subscription" : modalType === 'order' ? "Add Order" : "Collect Payment"}
        >
          {modalType === 'customer' ? (
            <CustomerForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              onSubmit={handleSave}
              saving={saving}
            />
          ) : modalType === 'subscription' ? (
            <SubscriptionForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              products={products}
              customers={[user]}
              onSubmit={handleSave}
              saving={saving}
            />
          ) : modalType === 'order' ? (
            <OrderForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              products={products}
              customers={[user]}
              onSubmit={handleSave}
              saving={saving}
            />
          ) : modalType === 'payment' ? (
            <div className="form-stack">
              <div className="form-group">
                <label>Amount Collected (Rs)</label>
                <input type="number" value={form?.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={form?.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Transaction ID / Reference</label>
                <input type="text" value={form?.transactionId || ""} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} placeholder="Optional UPI/Ref ID" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form?.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes about this payment" />
              </div>
            </div>
          ) : null}
          <div className="product-sheet-actions" style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : modalType === 'payment' ? "Record Payment" : `Save ${modalType}`}
            </button>
          </div>
        </BottomSheet>
      ) : (
        <Modal
          open={!!modalType}
          onClose={() => setModalType(null)}
          title={modalType === 'customer' ? "Edit Customer" : modalType === 'subscription' ? "Add Subscription" : modalType === 'order' ? "Add Order" : "Collect Payment"}
          footer={
            <div className="product-modal-footer">
              <div />
              <div className="product-modal-footer-right">
                <button className="btn btn-secondary btn-sm" onClick={() => setModalType(null)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : modalType === 'payment' ? "Record Payment" : `Save ${modalType}`}
                </button>
              </div>
            </div>
          }
        >
          {modalType === 'customer' ? (
            <CustomerForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              onSubmit={handleSave}
              saving={saving}
            />
          ) : modalType === 'subscription' ? (
            <SubscriptionForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              products={products}
              customers={[user]}
              onSubmit={handleSave}
              saving={saving}
            />
          ) : modalType === 'order' ? (
            <OrderForm
              form={form}
              onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
              products={products}
              customers={[user]}
              onSubmit={handleSave}
              saving={saving}
            />
          ) : modalType === 'payment' ? (
            <div className="form-stack">
              <div className="form-group">
                <label>Amount Collected (Rs)</label>
                <input type="number" value={form?.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={form?.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Transaction ID / Reference</label>
                <input type="text" value={form?.transactionId || ""} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} placeholder="Optional UPI/Ref ID" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form?.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes about this payment" />
              </div>
            </div>
          ) : null}
        </Modal>
      )}

      <Modal
        open={!!historyModal}
        onClose={() => setHistoryModal(null)}
        title="Payment History"
        footer={
          <button className="btn btn-secondary btn-sm" onClick={() => setHistoryModal(null)}>
            Close
          </button>
        }
      >
        <div className="history-ledger">
          {!historyModal?.payments?.length && !historyModal?.amountPaid ? (
            <p className="text-muted" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No payments recorded yet.</p>
          ) : (
            <div className="ledger-table-wrapper">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Ref / Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {historyModal?.payments?.map((p, idx) => (
                    <tr key={idx}>
                      <td>{formatDate(p.date)}</td>
                      <td><strong>{formatCurrency(p.amount)}</strong></td>
                      <td>
                        <span className="ledger-ref">{p.transactionId || "No Ref"}</span>
                        <span className="ledger-by">by {p.recordedBy?.name || "Admin"}</span>
                      </td>
                    </tr>
                  ))}
                  {historyModal?.amountPaid > 0 && (!historyModal?.payments || historyModal.payments.length === 0) && (
                    <tr>
                      <td>Legacy</td>
                      <td><strong>{formatCurrency(historyModal.amountPaid)}</strong></td>
                      <td>
                        <span className="ledger-ref">Direct Status Update</span>
                        <span className="ledger-by">Migrated Data</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="history-summary" style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '2px solid var(--border-soft)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Paid</span>
                <strong>{formatCurrency(historyModal?.amountPaid || 0)}</strong>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
                <span>Remaining</span>
                <strong className={(historyModal?.totalAmount - (historyModal?.amountPaid || 0)) > 0 ? "danger-text" : ""}>
                  {formatCurrency(Math.max(0, historyModal?.totalAmount - (historyModal?.amountPaid || 0)))}
                </strong>
             </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
