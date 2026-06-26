import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiRequest } from "../api/client";
import Modal from "../components/ui/Modal";
import StatusTag from "../components/ui/StatusTag";
import LoadingScreen from "../components/ui/LoadingScreen";
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

  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("collections");

  // Collections
  const [collections, setCollections] = useState([]);
  const [collectionFilters, setCollectionFilters] = useState({ from: "", to: "" });
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionTotals, setCollectionTotals] = useState({ liters: 0, amount: 0 });

  // Payments
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

  // Use refs so the tab-switch effect always calls the latest version of
  // these functions without re-triggering when filter state changes mid-session.
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
      <div style={{ padding: 32, textAlign: "center" }}>
        <p>Supplier not found.</p>
        <button className="mini-button" onClick={() => navigate("/suppliers")} style={{ marginTop: 12 }}>
          <ArrowLeft size={14} /> Back to Suppliers
        </button>
      </div>
    );
  }

  return (
    <div className="view-stack">
      {/* Back + Profile Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <button
          className="mini-button"
          onClick={() => navigate("/suppliers")}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={14} /> Suppliers
        </button>
      </div>

      <div className="surface" style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: "1.3em" }}>{supplier.name}</h2>
              {supplier.isActive ? <StatusTag value="active" /> : <StatusTag value="inactive" />}
            </div>
            <div className="text-muted" style={{ fontSize: "0.9em", display: "flex", flexWrap: "wrap", gap: 16 }}>
              <span>{supplier.phone}</span>
              {supplier.email && <span>{supplier.email}</span>}
              {supplier.location && <span>{supplier.location}{supplier.pincode ? ` — ${supplier.pincode}` : ""}</span>}
              {supplier.joiningDate && <span>Since {formatDate(supplier.joiningDate)}</span>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.8em", color: "var(--text-muted, #888)", marginBottom: 2 }}>Outstanding</div>
            <div style={{
              fontSize: "1.4em",
              fontWeight: 700,
              color: supplier.outstandingAmount > 0 ? "var(--color-warning, #d97706)" : "inherit",
            }}>
              {formatCurrency(supplier.outstandingAmount)}
            </div>
          </div>
        </div>

        {/* Collection defaults */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-color, #e5e7eb)", fontSize: "0.88em" }}>
          <div>
            <span className="text-muted">Sessions: </span>
            <span style={{ textTransform: "capitalize" }}>
              {(supplier.collectionSessions || []).join(", ") || "—"}
            </span>
          </div>
          <div>
            <span className="text-muted">Morning Default: </span>
            <span>{supplier.defaultMorningQty ?? 0} L</span>
          </div>
          <div>
            <span className="text-muted">Evening Default: </span>
            <span>{supplier.defaultEveningQty ?? 0} L</span>
          </div>
          <div>
            <span className="text-muted">Rate: </span>
            <span>₹{Number(supplier.defaultRatePerLiter || 0).toFixed(2)} / L</span>
          </div>
        </div>

        {/* Bank Details */}
        {supplier.bankDetails && (supplier.bankDetails.accountNo || supplier.bankDetails.bankName) && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-color, #e5e7eb)", fontSize: "0.88em" }}>
            <span className="text-muted" style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: "0.85em", letterSpacing: "0.05em" }}>
              BANK DETAILS
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
              {supplier.bankDetails.holderName && <div><span className="text-muted">Holder: </span>{supplier.bankDetails.holderName}</div>}
              {supplier.bankDetails.accountNo && <div><span className="text-muted">Account: </span>{supplier.bankDetails.accountNo}</div>}
              {supplier.bankDetails.ifscCode && <div><span className="text-muted">IFSC: </span>{supplier.bankDetails.ifscCode}</div>}
              {supplier.bankDetails.bankName && <div><span className="text-muted">Bank: </span>{supplier.bankDetails.bankName}</div>}
            </div>
          </div>
        )}

        {supplier.notes && (
          <div style={{ marginTop: 12, fontSize: "0.88em" }}>
            <span className="text-muted">Notes: </span>{supplier.notes}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="surface" style={{ padding: 0 }}>
        <div className="filter-tabs" style={{ borderBottom: "1px solid var(--border-color, #e5e7eb)", padding: "0 16px" }}>
          <button
            className={`filter-tab ${activeTab === "collections" ? "active" : ""}`}
            onClick={() => setActiveTab("collections")}
          >
            Collections
          </button>
          <button
            className={`filter-tab ${activeTab === "payments" ? "active" : ""}`}
            onClick={() => setActiveTab("payments")}
          >
            Payments
          </button>
        </div>

        {/* Collections Tab */}
        {activeTab === "collections" && (
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85em" }}>
                <span>From</span>
                <input
                  type="date"
                  className="search-input"
                  value={collectionFilters.from}
                  onChange={(e) => setCollectionFilters((f) => ({ ...f, from: e.target.value }))}
                  style={{ width: 160 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85em" }}>
                <span>To</span>
                <input
                  type="date"
                  className="search-input"
                  value={collectionFilters.to}
                  onChange={(e) => setCollectionFilters((f) => ({ ...f, to: e.target.value }))}
                  style={{ width: 160 }}
                />
              </label>
              <button className="mini-button" onClick={fetchCollections} disabled={collectionsLoading}>
                {collectionsLoading ? "Loading..." : "Apply"}
              </button>
            </div>

            {collections.length > 0 && (
              <div style={{ display: "flex", gap: 24, marginBottom: 14, fontSize: "0.9em", fontWeight: 600 }}>
                <span>Total collected: {Number(collectionTotals.liters).toFixed(1)} L</span>
                <span>Total amount: {formatCurrency(collectionTotals.amount)}</span>
              </div>
            )}

            {collectionsLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted, #888)" }}>Loading...</div>
            ) : collections.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted, #888)" }}>No collections found.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88em" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-color, #e5e7eb)", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Date</th>
                      <th style={{ padding: "8px 10px" }}>Session</th>
                      <th style={{ padding: "8px 10px" }}>Exp. Qty</th>
                      <th style={{ padding: "8px 10px" }}>Actual Qty</th>
                      <th style={{ padding: "8px 10px" }}>Fat %</th>
                      <th style={{ padding: "8px 10px" }}>SNF %</th>
                      <th style={{ padding: "8px 10px" }}>Rate / L</th>
                      <th style={{ padding: "8px 10px" }}>Amount</th>
                      <th style={{ padding: "8px 10px" }}>Status</th>
                      <th style={{ padding: "8px 10px" }}>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map((c) => (
                      <tr key={c._id} style={{ borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>
                        <td style={{ padding: "8px 10px" }}>{formatDate(c.date)}</td>
                        <td style={{ padding: "8px 10px", textTransform: "capitalize" }}>{c.session}</td>
                        <td style={{ padding: "8px 10px" }}>{c.expectedQty ?? "—"}</td>
                        <td style={{ padding: "8px 10px" }}>{c.actualQty != null ? c.actualQty : <span className="text-muted">—</span>}</td>
                        <td style={{ padding: "8px 10px" }}>{c.fatContent != null ? c.fatContent : <span className="text-muted">—</span>}</td>
                        <td style={{ padding: "8px 10px" }}>{c.snf != null ? c.snf : <span className="text-muted">—</span>}</td>
                        <td style={{ padding: "8px 10px" }}>₹{Number(c.ratePerLiter || 0).toFixed(2)}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                          {c.totalAmount != null ? formatCurrency(c.totalAmount) : <span className="text-muted">—</span>}
                        </td>
                        <td style={{ padding: "8px 10px" }}><StatusTag value={c.status} /></td>
                        <td style={{ padding: "8px 10px" }}>
                          {c.paymentId ? <StatusTag value="paid" /> : <StatusTag value="unpaid" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <button
                className="primary-button"
                onClick={() => {
                  setPaymentForm({ ...PAYMENT_EMPTY });
                  setPaymentModal(true);
                }}
              >
                Record Payment
              </button>
            </div>

            {paymentsLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted, #888)" }}>Loading...</div>
            ) : payments.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted, #888)" }}>No payments recorded yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88em" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-color, #e5e7eb)", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Paid On</th>
                      <th style={{ padding: "8px 10px" }}>Period</th>
                      <th style={{ padding: "8px 10px" }}>Collections</th>
                      <th style={{ padding: "8px 10px" }}>Amount</th>
                      <th style={{ padding: "8px 10px" }}>Method</th>
                      <th style={{ padding: "8px 10px" }}>Ref</th>
                      <th style={{ padding: "8px 10px" }}>Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p._id} style={{ borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>
                        <td style={{ padding: "8px 10px" }}>{formatDate(p.paidAt)}</td>
                        <td style={{ padding: "8px 10px" }}>
                          {formatDate(p.fromDate)} – {formatDate(p.toDate)}
                        </td>
                        <td style={{ padding: "8px 10px" }}>{p.collectionCount}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                        <td style={{ padding: "8px 10px", textTransform: "capitalize" }}>
                          {p.paymentMethod?.replace("_", " ")}
                        </td>
                        <td style={{ padding: "8px 10px" }}>{p.transactionRef || <span className="text-muted">—</span>}</td>
                        <td style={{ padding: "8px 10px" }}>{p.recordedBy?.name || <span className="text-muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        title="Record Payment"
        footer={
          <div className="modal-actions">
            <button className="mini-button" onClick={() => setPaymentModal(false)} disabled={savingPayment}>Cancel</button>
            <button className="mini-button active" onClick={handleRecordPayment} disabled={savingPayment}>
              {savingPayment ? "Saving..." : "Record"}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Amount (₹) <em className="required">*</em></span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
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
            <span>From Date <em className="required">*</em></span>
            <input
              type="date"
              value={paymentForm.fromDate}
              onChange={(e) => setPaymentForm((f) => ({ ...f, fromDate: e.target.value }))}
              required
            />
          </label>
          <label className="form-field">
            <span>To Date <em className="required">*</em></span>
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
