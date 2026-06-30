import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import Modal from "../components/ui/Modal";
import StatusTag from "../components/ui/StatusTag";
import LoadingScreen from "../components/ui/LoadingScreen";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

function formatCurrency(val) {
  return `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(val) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const PAYMENT_EMPTY = {
  amount: "", fromDate: "", toDate: "",
  paymentMethod: "cash", transactionRef: "", notes: "",
};

export default function SupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("collections");

  const [collections, setCollections] = useState([]);
  const [collectionFilters, setCollectionFilters] = useState({ from: "", to: "" });
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionTotals, setCollectionTotals] = useState({ liters: 0, amount: 0 });

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ ...PAYMENT_EMPTY });
  const [savingPayment, setSavingPayment] = useState(false);

  const fetchSupplier = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/suppliers/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSupplier(data.supplier);
    } catch (err) {
      toast.error(err.message || "Failed to load supplier.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchCollections = useCallback(async () => {
    setCollectionsLoading(true);
    try {
      const params = new URLSearchParams({ supplierId: id, limit: "200" });
      if (collectionFilters.from) params.set("from", collectionFilters.from);
      if (collectionFilters.to) params.set("to", collectionFilters.to);
      const res = await apiRequest(`/api/milk-collections?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const cols = data.collections || [];
      setCollections(cols);
      const confirmed = cols.filter((c) => c.status === "confirmed");
      setCollectionTotals({
        liters: confirmed.reduce((s, c) => s + (c.actualQty || 0), 0),
        amount: confirmed.reduce((s, c) => s + (c.totalAmount || 0), 0),
      });
    } catch (err) {
      toast.error(err.message || "Failed to load collections.");
    } finally {
      setCollectionsLoading(false);
    }
  }, [id, collectionFilters]);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await apiRequest(`/api/supplier-payments/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPayments(data.payments || []);
    } catch (err) {
      toast.error(err.message || "Failed to load payments.");
    } finally {
      setPaymentsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchSupplier(); }, [fetchSupplier]);

  const fetchCollectionsRef = useRef(fetchCollections);
  const fetchPaymentsRef = useRef(fetchPayments);
  useEffect(() => { fetchCollectionsRef.current = fetchCollections; }, [fetchCollections]);
  useEffect(() => { fetchPaymentsRef.current = fetchPayments; }, [fetchPayments]);

  useEffect(() => {
    if (activeTab === "collections") fetchCollectionsRef.current();
    if (activeTab === "payments") fetchPaymentsRef.current();
  }, [activeTab]);

  const handleRecordPayment = useCallback(async () => {
    if (!paymentForm.amount || !paymentForm.fromDate || !paymentForm.toDate) {
      toast.error("Amount, from date, and to date are required.");
      return;
    }
    setSavingPayment(true);
    try {
      const res = await apiRequest("/api/supplier-payments", {
        method: "POST",
        body: JSON.stringify({
          supplierId: id,
          amount: parseFloat(paymentForm.amount),
          fromDate: paymentForm.fromDate,
          toDate: paymentForm.toDate,
          paymentMethod: paymentForm.paymentMethod,
          transactionRef: paymentForm.transactionRef,
          notes: paymentForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setPaymentModal(false);
      setPaymentForm({ ...PAYMENT_EMPTY });
      fetchSupplier();
      fetchPayments();
    } catch (err) {
      toast.error(err.message || "Failed to record payment.");
    } finally {
      setSavingPayment(false);
    }
  }, [id, paymentForm, fetchSupplier, fetchPayments]);

  if (loading) return <LoadingScreen />;
  if (!supplier) {
    return (
      <EmptyState
        text="Supplier not found."
        action={<button className="mini-button" onClick={() => navigate("/suppliers")}>Back to Suppliers</button>}
      />
    );
  }

  const hasBankDetails = supplier.bankDetails &&
    (supplier.bankDetails.accountNo || supplier.bankDetails.bankName);

  return (
    <div className="view-stack">

      {/* ── Page Header (breadcrumb only) ───────────── */}
      <PageHeader
        className="supplier-breadcrumb-only"
        breadcrumb={[
          { label: "Suppliers", path: "/suppliers" },
          { label: supplier.name },
        ]}
      />

      {/* ── Profile Card ─────────────────────────────── */}
      <div className="panel supplier-profile-panel">

        {/* Name row + outstanding */}
        <div className="supplier-profile-top">
          <div className="supplier-identity">
            <div className="supplier-name-row">
              <h2>{supplier.name}</h2>
              <StatusTag value={supplier.isActive ? "active" : "inactive"} />
            </div>
            <div className="supplier-contact-row">
              <span>{supplier.phone}</span>
              {supplier.email && <span>{supplier.email}</span>}
              {supplier.location && (
                <span>{supplier.location}{supplier.pincode ? ` — ${supplier.pincode}` : ""}</span>
              )}
              {supplier.joiningDate && (
                <span>Since {formatDate(supplier.joiningDate)}</span>
              )}
            </div>
          </div>

          <div className="supplier-outstanding">
            <p className="eyebrow">Outstanding</p>
            <span
              className={`supplier-outstanding-amount ${supplier.outstandingAmount > 0 ? "danger-text" : "success-text"}`}
            >
              {formatCurrency(supplier.outstandingAmount)}
            </span>
          </div>
        </div>

        {/* Defaults strip */}
        <div className="supplier-defaults-strip">
          <div className="supplier-default-chip">
            <span>Rate / L</span>
            <strong>₹{Number(supplier.defaultRatePerLiter || 0).toFixed(2)}</strong>
          </div>
          <div className="supplier-default-chip">
            <span>Sessions</span>
            <strong>{(supplier.collectionSessions || []).join(" & ") || "—"}</strong>
          </div>
          {supplier.collectionSessions?.includes("morning") && (
            <div className="supplier-default-chip">
              <span>Morning Qty</span>
              <strong>{supplier.defaultMorningQty ?? 0} L</strong>
            </div>
          )}
          {supplier.collectionSessions?.includes("evening") && (
            <div className="supplier-default-chip">
              <span>Evening Qty</span>
              <strong>{supplier.defaultEveningQty ?? 0} L</strong>
            </div>
          )}
        </div>

        {/* Bank details */}
        {hasBankDetails && (
          <div className="supplier-bank-section">
            <p className="eyebrow">Bank Details</p>
            <div className="supplier-bank-grid">
              {supplier.bankDetails.holderName && (
                <div className="supplier-bank-item">
                  <span>Holder</span>
                  <strong>{supplier.bankDetails.holderName}</strong>
                </div>
              )}
              {supplier.bankDetails.accountNo && (
                <div className="supplier-bank-item">
                  <span>Account No.</span>
                  <strong>{supplier.bankDetails.accountNo}</strong>
                </div>
              )}
              {supplier.bankDetails.ifscCode && (
                <div className="supplier-bank-item">
                  <span>IFSC</span>
                  <strong>{supplier.bankDetails.ifscCode}</strong>
                </div>
              )}
              {supplier.bankDetails.bankName && (
                <div className="supplier-bank-item">
                  <span>Bank</span>
                  <strong>{supplier.bankDetails.bankName}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {supplier.notes && (
          <div className="supplier-notes">
            <p className="eyebrow">Notes</p>
            <p>{supplier.notes}</p>
          </div>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────── */}
      <section className="panel detail-tabs-panel">
        <div className="scrollable-tab-bar">
          <button
            className={`tab-pill ${activeTab === "collections" ? "active" : ""}`}
            onClick={() => setActiveTab("collections")}
          >
            Collections
          </button>
          <button
            className={`tab-pill ${activeTab === "payments" ? "active" : ""}`}
            onClick={() => setActiveTab("payments")}
          >
            Payments
          </button>
        </div>

        {/* ── Collections Tab ──────────────────────── */}
        {activeTab === "collections" && (
          <div className="tab-content">

            {/* Date filters */}
            <div className="supplier-col-filters">
              <label className="form-field">
                <span>From</span>
                <input
                  type="date"
                  value={collectionFilters.from}
                  onChange={(e) => setCollectionFilters((f) => ({ ...f, from: e.target.value }))}
                />
              </label>
              <label className="form-field">
                <span>To</span>
                <input
                  type="date"
                  value={collectionFilters.to}
                  onChange={(e) => setCollectionFilters((f) => ({ ...f, to: e.target.value }))}
                />
              </label>
              <button className="mini-button sc-apply-btn" onClick={fetchCollections} disabled={collectionsLoading}>
                {collectionsLoading ? "Loading…" : "Apply"}
              </button>
            </div>

            {/* Totals */}
            {collections.length > 0 && (
              <div className="supplier-totals-strip">
                <div className="supplier-total-chip">
                  <span>Total Collected</span>
                  <strong>{Number(collectionTotals.liters).toFixed(1)} L</strong>
                </div>
                <div className="supplier-total-chip">
                  <span>Total Amount</span>
                  <strong>{formatCurrency(collectionTotals.amount)}</strong>
                </div>
              </div>
            )}

            {collectionsLoading ? (
              <div className="tab-loading">Loading collections…</div>
            ) : collections.length === 0 ? (
              <EmptyState text="No collections found for this period." />
            ) : isMobile ? (
              /* ── Mobile: collection cards ── */
              <div className="sc-list">
                {collections.map((c) => (
                  <div key={c._id} className="sc-card">
                    {/* Header: date + session + badges */}
                    <div className="sc-card-head">
                      <div className="sc-card-date">
                        <strong>{formatDate(c.date)}</strong>
                        <span className="sc-session">{c.session}</span>
                      </div>
                      <div className="sc-card-badges">
                        <StatusTag value={c.status} />
                        {c.paymentId ? <StatusTag value="paid" /> : <StatusTag value="unpaid" />}
                      </div>
                    </div>
                    {/* Row 1: Actual · Fat · SNF */}
                    <div className="sc-card-stats">
                      <div className="sc-stat">
                        <span>Actual</span>
                        <strong>{c.actualQty != null ? `${c.actualQty} L` : "—"}</strong>
                      </div>
                      <div className="sc-stat">
                        <span>Fat %</span>
                        <strong>{c.fatContent != null ? c.fatContent : "—"}</strong>
                      </div>
                      <div className="sc-stat">
                        <span>SNF %</span>
                        <strong>{c.snf != null ? c.snf : "—"}</strong>
                      </div>
                    </div>
                    {/* Row 2: Rate · Amount */}
                    <div className="sc-card-stats sc-card-stats--bottom">
                      <div className="sc-stat">
                        <span>Rate / L</span>
                        <strong>₹{Number(c.ratePerLiter || 0).toFixed(2)}</strong>
                      </div>
                      <div className="sc-stat sc-stat--amount">
                        <span>Amount</span>
                        <strong>{c.totalAmount != null ? formatCurrency(c.totalAmount) : "—"}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Desktop: scroll table ── */
              <div className="scroll-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Session</th>
                      <th>Exp.</th>
                      <th>Actual</th>
                      <th>Fat %</th>
                      <th>SNF %</th>
                      <th>Rate/L</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map((c) => (
                      <tr key={c._id}>
                        <td>{formatDate(c.date)}</td>
                        <td style={{ textTransform: "capitalize" }}>{c.session}</td>
                        <td>{c.expectedQty ?? "—"}</td>
                        <td>{c.actualQty != null ? c.actualQty : <span className="muted-text">—</span>}</td>
                        <td>{c.fatContent != null ? c.fatContent : <span className="muted-text">—</span>}</td>
                        <td>{c.snf != null ? c.snf : <span className="muted-text">—</span>}</td>
                        <td>₹{Number(c.ratePerLiter || 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 600 }}>
                          {c.totalAmount != null ? formatCurrency(c.totalAmount) : <span className="muted-text">—</span>}
                        </td>
                        <td><StatusTag value={c.status} /></td>
                        <td>{c.paymentId ? <StatusTag value="paid" /> : <StatusTag value="unpaid" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Payments Tab ─────────────────────────── */}
        {activeTab === "payments" && (
          <div className="tab-content">
            <div className="tab-action-row">
              <button
                className="primary-button"
                onClick={() => { setPaymentForm({ ...PAYMENT_EMPTY }); setPaymentModal(true); }}
              >
                Record Payment
              </button>
            </div>

            {paymentsLoading ? (
              <div className="tab-loading">Loading payments…</div>
            ) : payments.length === 0 ? (
              <EmptyState text="No payments recorded yet." />
            ) : isMobile ? (
              /* ── Mobile: payment cards ── */
              <div className="sc-list">
                {payments.map((p) => (
                  <div key={p._id} className="sp-card">
                    <div className="sp-card-head">
                      <strong className="sp-amount">{formatCurrency(p.amount)}</strong>
                      <span className="sp-method">{p.paymentMethod?.replace("_", " ")}</span>
                    </div>
                    <div className="sp-card-body">
                      <div className="sp-card-period">
                        Period: {formatDate(p.fromDate)} – {formatDate(p.toDate)}
                      </div>
                      <div className="sp-card-foot">
                        <span className="sp-meta">{p.collectionCount} collections</span>
                        <span className="sp-meta">Paid {formatDate(p.paidAt)}</span>
                        {p.transactionRef && <span className="sp-ref">{p.transactionRef}</span>}
                      </div>
                    </div>
                    {p.recordedBy?.name && (
                      <div className="sp-recorded-by">Recorded by {p.recordedBy.name}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* ── Desktop: scroll table ── */
              <div className="scroll-table">
                <table>
                  <thead>
                    <tr>
                      <th>Paid On</th>
                      <th>Period</th>
                      <th>Collections</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Ref</th>
                      <th>Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p._id}>
                        <td>{formatDate(p.paidAt)}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {formatDate(p.fromDate)} – {formatDate(p.toDate)}
                        </td>
                        <td>{p.collectionCount}</td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                        <td style={{ textTransform: "capitalize" }}>
                          {p.paymentMethod?.replace("_", " ")}
                        </td>
                        <td>{p.transactionRef || <span className="muted-text">—</span>}</td>
                        <td>{p.recordedBy?.name || <span className="muted-text">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Record Payment Modal ─────────────────────── */}
      <Modal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        title="Record Payment"
        footer={
          <div className="modal-actions">
            <button className="mini-button" onClick={() => setPaymentModal(false)} disabled={savingPayment}>
              Cancel
            </button>
            <button className="mini-button active" onClick={handleRecordPayment} disabled={savingPayment}>
              {savingPayment ? "Saving…" : "Record"}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Amount (₹) <em>*</em></span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              required
            />
          </label>
          <label className="form-field">
            <span>Payment Method</span>
            <select
              value={paymentForm.paymentMethod}
              onChange={(e) => setPaymentForm((f) => ({ ...f, paymentMethod: e.target.value }))}
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
            </select>
          </label>
          <label className="form-field">
            <span>From Date <em>*</em></span>
            <input
              type="date"
              value={paymentForm.fromDate}
              onChange={(e) => setPaymentForm((f) => ({ ...f, fromDate: e.target.value }))}
              required
            />
          </label>
          <label className="form-field">
            <span>To Date <em>*</em></span>
            <input
              type="date"
              value={paymentForm.toDate}
              onChange={(e) => setPaymentForm((f) => ({ ...f, toDate: e.target.value }))}
              required
            />
          </label>
          <label className="form-field">
            <span>Transaction Reference</span>
            <input
              type="text"
              value={paymentForm.transactionRef}
              onChange={(e) => setPaymentForm((f) => ({ ...f, transactionRef: e.target.value }))}
              placeholder="UPI txn ID, cheque no., etc."
            />
          </label>
          <label className="form-field">
            <span>Notes</span>
            <textarea
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
