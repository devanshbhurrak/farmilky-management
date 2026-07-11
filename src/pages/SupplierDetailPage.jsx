import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Pencil, ChevronDown, SquarePen, Trash2 } from "lucide-react";
import { apiRequest } from "../api/client";
import Modal from "../components/ui/Modal";
import BottomSheet from "../components/ui/BottomSheet";
import ConfirmDialog from "../components/ui/ConfirmDialog";
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
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ ...PAYMENT_EMPTY });
  const [savingPayment, setSavingPayment] = useState(false);

  const [passbookData, setPassbookData] = useState(null);
  const [passbookLoading, setPassbookLoading] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({
    type: "debit", category: "other", amount: "",
    date: new Date().toISOString().split("T")[0], description: "", notes: "",
  });
  const [savingAdj, setSavingAdj] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const [colEditTarget, setColEditTarget] = useState(null); // collection being edited
  const [colEditForm, setColEditForm] = useState({});
  const [savingCol, setSavingCol] = useState(false);

  const [colConfirmTarget, setColConfirmTarget] = useState(null); // pending collection to confirm
  const [colConfirmForm, setColConfirmForm] = useState({});
  const [savingConfirm, setSavingConfirm] = useState(false);

  const [periodTotal, setPeriodTotal] = useState(null); // { collectionTotal, collectionCount }

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

  const fetchPassbook = useCallback(async () => {
    setPassbookLoading(true);
    try {
      const res = await apiRequest(`/api/suppliers/${id}/passbook`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPassbookData(data);
    } catch (err) {
      toast.error(err.message || "Failed to load passbook.");
    } finally {
      setPassbookLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "collections") fetchCollectionsRef.current();
    if (activeTab === "payments") fetchPaymentsRef.current();
    if (activeTab === "passbook") fetchPassbook();
  }, [activeTab, fetchPassbook]);

  const handleRecordPayment = useCallback(async () => {
    if (!paymentForm.fromDate || !paymentForm.toDate) {
      toast.error("From date and to date are required.");
      return;
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error("Please enter a valid payment amount.");
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
      let msg = data.message;
      if (data.adjustment) {
        const adj = data.adjustment;
        msg += ` ${adj.type === "credit" ? "+" : "−"}${formatCurrency(adj.amount)} auto-adjusted.`;
      }
      toast.success(msg);
      setPaymentModal(false);
      setPaymentForm({ ...PAYMENT_EMPTY });
      setPeriodTotal(null);
      fetchSupplier();
      fetchPayments();
    } catch (err) {
      toast.error(err.message || "Failed to record payment.");
    } finally {
      setSavingPayment(false);
    }
  }, [id, paymentForm, fetchSupplier, fetchPayments]);

  const fetchPeriodTotal = useCallback(async (fromDate, toDate) => {
    if (!fromDate || !toDate) { setPeriodTotal(null); return; }
    try {
      const params = new URLSearchParams({ supplierId: id, from: fromDate, to: toDate });
      const res = await apiRequest(`/api/supplier-payments/collection-total?${params}`);
      const data = await res.json();
      if (res.ok) {
        setPeriodTotal(data);
        if (data.collectionTotal > 0) {
          setPaymentForm((f) => ({ ...f, amount: data.collectionTotal.toFixed(2) }));
        }
      }
    } catch { setPeriodTotal(null); }
  }, [id]);

  const openPaymentModal = useCallback(() => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const toDate = yest.toISOString().split("T")[0];
    setPeriodTotal(null);
    setPaymentForm({ ...PAYMENT_EMPTY, toDate });
    setPaymentModal(true);
  }, []);

  const handleCreateAdjustment = useCallback(async () => {
    if (!adjForm.amount || !adjForm.description || !adjForm.date) {
      toast.error("Amount, date, and description are required.");
      return;
    }
    setSavingAdj(true);
    try {
      const res = await apiRequest(`/api/suppliers/${id}/adjustments`, {
        method: "POST",
        body: JSON.stringify(adjForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Adjustment recorded.");
      setAdjOpen(false);
      setAdjForm({ type: "debit", category: "other", amount: "", date: new Date().toISOString().split("T")[0], description: "", notes: "" });
      fetchPassbook();
      fetchSupplier();
    } catch (err) {
      toast.error(err.message || "Failed to record adjustment.");
    } finally {
      setSavingAdj(false);
    }
  }, [id, adjForm, fetchPassbook, fetchSupplier]);

  const handleDeleteAdjustment = useCallback(async (adjId) => {
    try {
      const res = await apiRequest(`/api/suppliers/${id}/adjustments/${adjId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Adjustment deleted.");
      fetchPassbook();
      fetchSupplier();
    } catch (err) {
      toast.error(err.message || "Failed to delete adjustment.");
    }
  }, [id, fetchPassbook, fetchSupplier]);

  const openColConfirm = useCallback((c) => {
    setColConfirmTarget(c);
    setColConfirmForm({
      actualQty: c.expectedQty?.toString() ?? "",
      ratePerLiter: c.ratePerLiter?.toString() ?? "",
      fatContent: "",
      snf: "",
      notes: "",
    });
  }, []);

  const handleColConfirm = useCallback(async () => {
    if (!colConfirmTarget) return;
    if (!colConfirmForm.actualQty || !colConfirmForm.ratePerLiter) {
      toast.error("Actual quantity and rate are required.");
      return;
    }
    setSavingConfirm(true);
    try {
      const body = {
        actualQty: parseFloat(colConfirmForm.actualQty),
        ratePerLiter: parseFloat(colConfirmForm.ratePerLiter),
        fatContent: colConfirmForm.fatContent !== "" ? parseFloat(colConfirmForm.fatContent) : null,
        snf: colConfirmForm.snf !== "" ? parseFloat(colConfirmForm.snf) : null,
        notes: colConfirmForm.notes,
      };
      const res = await apiRequest(`/api/milk-collections/${colConfirmTarget._id}/confirm`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Collection confirmed.");
      setColConfirmTarget(null);
      fetchCollections();
      fetchSupplier();
    } catch (err) {
      toast.error(err.message || "Failed to confirm collection.");
    } finally {
      setSavingConfirm(false);
    }
  }, [colConfirmTarget, colConfirmForm, fetchCollections, fetchSupplier]);

  const openColEdit = useCallback((c) => {
    setColEditTarget(c);
    setColEditForm({
      actualQty: c.actualQty?.toString() ?? "",
      ratePerLiter: c.ratePerLiter?.toString() ?? "",
      fatContent: c.fatContent?.toString() ?? "",
      snf: c.snf?.toString() ?? "",
      notes: c.notes ?? "",
    });
  }, []);

  const handleColSave = useCallback(async () => {
    if (!colEditTarget) return;
    setSavingCol(true);
    try {
      const body = {
        actualQty: colEditForm.actualQty !== "" ? parseFloat(colEditForm.actualQty) : undefined,
        ratePerLiter: colEditForm.ratePerLiter !== "" ? parseFloat(colEditForm.ratePerLiter) : undefined,
        fatContent: colEditForm.fatContent !== "" ? parseFloat(colEditForm.fatContent) : null,
        snf: colEditForm.snf !== "" ? parseFloat(colEditForm.snf) : null,
        notes: colEditForm.notes,
      };
      const res = await apiRequest(`/api/milk-collections/${colEditTarget._id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Collection updated.");
      setColEditTarget(null);
      fetchCollections();
      fetchSupplier();
    } catch (err) {
      toast.error(err.message || "Failed to update collection.");
    } finally {
      setSavingCol(false);
    }
  }, [colEditTarget, colEditForm, fetchCollections, fetchSupplier]);

  const openEdit = useCallback(() => {
    if (!supplier) return;
    setEditForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      location: supplier.location || "",
      pincode: supplier.pincode || "",
      joiningDate: supplier.joiningDate ? new Date(supplier.joiningDate).toISOString().split("T")[0] : "",
      collectionSessions: supplier.collectionSessions || ["morning", "evening"],
      defaultMorningQty: supplier.defaultMorningQty?.toString() || "",
      defaultEveningQty: supplier.defaultEveningQty?.toString() || "",
      defaultRatePerLiter: supplier.defaultRatePerLiter?.toString() || "",
      bankDetails: supplier.bankDetails || { accountNo: "", ifscCode: "", bankName: "", holderName: "" },
      notes: supplier.notes || "",
    });
    setEditOpen(true);
  }, [supplier]);

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setEditForm(null);
  }, []);

  const handleSessionToggle = useCallback((session) => {
    setEditForm((prev) => {
      const sessions = prev.collectionSessions.includes(session)
        ? prev.collectionSessions.filter((s) => s !== session)
        : [...prev.collectionSessions, session];
      return { ...prev, collectionSessions: sessions };
    });
  }, []);

  const handleBankChange = useCallback((field, value) => {
    setEditForm((prev) => ({ ...prev, bankDetails: { ...prev.bankDetails, [field]: value } }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!editForm.name || !editForm.phone) { toast.error("Name and phone are required."); return; }
    if (editForm.collectionSessions.length === 0) { toast.error("Select at least one session."); return; }
    setSaving(true);
    try {
      const payload = {
        name: editForm.name, phone: editForm.phone, email: editForm.email,
        location: editForm.location, pincode: editForm.pincode,
        joiningDate: editForm.joiningDate || null,
        collectionSessions: editForm.collectionSessions,
        defaultMorningQty: editForm.defaultMorningQty ? parseFloat(editForm.defaultMorningQty) : 0,
        defaultEveningQty: editForm.defaultEveningQty ? parseFloat(editForm.defaultEveningQty) : 0,
        defaultRatePerLiter: editForm.defaultRatePerLiter ? parseFloat(editForm.defaultRatePerLiter) : 0,
        bankDetails: editForm.bankDetails, notes: editForm.notes,
      };
      const res = await apiRequest(`/api/suppliers/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success("Supplier updated.");
      closeEdit();
      fetchSupplier();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }, [id, editForm, closeEdit, fetchSupplier]);

  const handleToggleStatus = useCallback(async () => {
    if (!confirmAction || confirmAction.type !== "toggle") return;
    try {
      const res = await apiRequest(`/api/suppliers/${id}/status`, {
        method: "PATCH", body: JSON.stringify({ isActive: !supplier.isActive }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success(result.message);
      setConfirmAction(null);
      fetchSupplier();
    } catch (err) { toast.error(err.message); }
  }, [id, supplier, confirmAction, fetchSupplier]);

  const handleDelete = useCallback(async () => {
    if (!confirmAction || confirmAction.type !== "delete") return;
    try {
      const res = await apiRequest(`/api/suppliers/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success(result.message);
      setConfirmAction(null);
      navigate("/suppliers");
    } catch (err) { toast.error(err.message); }
  }, [id, confirmAction, navigate]);

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
              <button className="mini-button supplier-name-edit" onClick={openEdit}>
                <Pencil size={14} /> Edit
              </button>
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
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
              Supply: {formatCurrency(supplier.supplyBalance)} · Passbook: {formatCurrency(supplier.passbookBalance)}
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
          <button
            className={`tab-pill ${activeTab === "passbook" ? "active" : ""}`}
            onClick={() => setActiveTab("passbook")}
          >
            Passbook
          </button>
        </div>

        {/* ── Collections Tab ──────────────────────── */}
        {activeTab === "collections" && (
          <div className="tab-content">

            {/* Date filters */}
            <div className="supplier-filter-toggle" onClick={() => setFiltersOpen((o) => !o)}>
              <span>Filter by date</span>
              <ChevronDown size={14} className={`supplier-filter-chevron ${filtersOpen ? "open" : ""}`} />
            </div>
            {filtersOpen && (
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
            )}

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
                        {c.status === "confirmed" && (c.paymentId ? <StatusTag value="paid" /> : <StatusTag value="unpaid" />)}
                        {c.status === "pending"
                          ? <button className="mini-button active" style={{ fontSize: "11px", padding: "2px 8px" }} onClick={() => openColConfirm(c)}>Confirm</button>
                          : <button className="supplier-card-edit-btn" onClick={() => openColEdit(c)} title="Edit"><SquarePen size={13} /></button>
                        }
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
                        <span>{c.totalAmount != null ? "Amount" : "Est. Amount"}</span>
                        <strong>
                          {c.totalAmount != null
                            ? formatCurrency(c.totalAmount)
                            : c.expectedQty && c.ratePerLiter
                              ? formatCurrency(c.expectedQty * c.ratePerLiter)
                              : "—"}
                        </strong>
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
                      <th></th>
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
                          {c.totalAmount != null
                            ? formatCurrency(c.totalAmount)
                            : c.expectedQty && c.ratePerLiter
                              ? <span className="muted-text">{formatCurrency(c.expectedQty * c.ratePerLiter)}*</span>
                              : <span className="muted-text">—</span>}
                        </td>
                        <td><StatusTag value={c.status} /></td>
                        <td>{c.status === "confirmed" ? (c.paymentId ? <StatusTag value="paid" /> : <StatusTag value="unpaid" />) : null}</td>
                        <td>
                          {c.status === "pending"
                            ? <button className="mini-button active" style={{ fontSize: "11px", padding: "2px 10px" }} onClick={() => openColConfirm(c)}>Confirm</button>
                            : <button className="supplier-card-edit-btn" onClick={() => openColEdit(c)} title="Edit"><SquarePen size={13} /></button>
                          }
                        </td>
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
                onClick={openPaymentModal}
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

        {activeTab === "passbook" && (
          <div className="tab-content">
            <div className="tab-action-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)" }}>
                Passbook Balance: <strong className={passbookData?.supplier?.passbookBalance > 0 ? "danger-text" : passbookData?.supplier?.passbookBalance < 0 ? "success-text" : ""}>{formatCurrency(passbookData?.supplier?.passbookBalance || 0)}</strong>
              </span>
              <button className="primary-button" onClick={() => setAdjOpen(true)}>
                Add Adjustment
              </button>
            </div>
            {passbookLoading ? (
              <div className="tab-loading">Loading passbook…</div>
            ) : !passbookData || passbookData.entries.length === 0 ? (
              <EmptyState text="No passbook entries yet." />
            ) : (
              <div className="stack-list">
                {passbookData.entries.map((entry) => (
                  <div key={entry._id} className="list-card">
                    <div>
                      <strong>{entry.description}</strong>
                      <span>
                        {formatDate(entry.date)}
                        {entry.notes ? ` · ${entry.notes}` : ""}
                        {entry.recordedBy ? ` · by ${entry.recordedBy}` : ""}
                        {entry.isAuto ? " · auto" : ""}
                      </span>
                    </div>
                    <div className="card-figure" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ color: entry.type === "credit" ? "var(--color-primary-dark)" : "var(--danger-text)", display: "block" }}>
                          {entry.type === "credit" ? "+" : "−"}{formatCurrency(entry.amount)}
                        </strong>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "capitalize" }}>
                          {entry.category?.replace("_", " ")}
                        </span>
                      </div>
                      {!entry.isAuto && (
                        <button
                          className="supplier-card-edit-btn"
                          onClick={() => handleDeleteAdjustment(entry._id)}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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
            <span>From Date <em>*</em></span>
            <input
              type="date"
              value={paymentForm.fromDate}
              onChange={(e) => {
                const fromDate = e.target.value;
                setPaymentForm((f) => ({ ...f, fromDate }));
                fetchPeriodTotal(fromDate, paymentForm.toDate);
              }}
              required
            />
          </label>
          <label className="form-field">
            <span>To Date <em>*</em></span>
            <input
              type="date"
              value={paymentForm.toDate}
              onChange={(e) => {
                const toDate = e.target.value;
                setPaymentForm((f) => ({ ...f, toDate }));
                fetchPeriodTotal(paymentForm.fromDate, toDate);
              }}
              required
            />
          </label>
          <label className="form-field" style={{ gridColumn: "1 / -1" }}>
            <span>Amount (₹) <em>*</em></span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
            />
            {periodTotal && (
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                Collections in period: {formatCurrency(periodTotal.collectionTotal)} ({periodTotal.collectionCount} entries)
                {paymentForm.amount && Math.abs(parseFloat(paymentForm.amount || 0) - periodTotal.collectionTotal) > 0.01
                  ? (() => {
                      const diff = parseFloat(paymentForm.amount || 0) - periodTotal.collectionTotal;
                      return ` · Diff: ${diff > 0 ? "−" : "+"}${formatCurrency(Math.abs(diff))} (auto-adjusted)`;
                    })()
                  : ""}
              </span>
            )}
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

      {/* ── Edit Supplier Modal / Sheet ─────────────── */}
      {editForm && (isMobile ? (
        <BottomSheet isOpen={editOpen} onClose={closeEdit} title="Edit Supplier">
          <div className="supplier-form">
            <div className="supplier-form-section">
              <p className="eyebrow">Basic Information</p>
              <div className="form-grid">
                <label className="form-field"><span>Name <em className="required">*</em></span><input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></label>
                <label className="form-field"><span>Phone <em className="required">*</em></span><input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} /></label>
                <label className="form-field"><span>Email</span><input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} /></label>
                <label className="form-field"><span>Location</span><input type="text" value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} /></label>
                <label className="form-field"><span>Pincode</span><input type="text" value={editForm.pincode} onChange={(e) => setEditForm((f) => ({ ...f, pincode: e.target.value }))} /></label>
                <label className="form-field"><span>Joining Date</span><input type="date" value={editForm.joiningDate} onChange={(e) => setEditForm((f) => ({ ...f, joiningDate: e.target.value }))} /></label>
              </div>
            </div>
            <div className="supplier-form-section">
              <p className="eyebrow">Collection Settings</p>
              <div className="form-grid">
                <div className="form-field full-span">
                  <span>Sessions <em className="required">*</em></span>
                  <div className="supplier-session-toggles">
                    {["morning", "evening"].map((s) => (
                      <label key={s} className="supplier-session-option"><input type="checkbox" checked={editForm.collectionSessions.includes(s)} onChange={() => handleSessionToggle(s)} /><span>{s}</span></label>
                    ))}
                  </div>
                </div>
                <label className="form-field"><span>Morning Qty (L)</span><input type="number" min="0" step="0.1" value={editForm.defaultMorningQty} onChange={(e) => setEditForm((f) => ({ ...f, defaultMorningQty: e.target.value }))} placeholder="0" /></label>
                <label className="form-field"><span>Evening Qty (L)</span><input type="number" min="0" step="0.1" value={editForm.defaultEveningQty} onChange={(e) => setEditForm((f) => ({ ...f, defaultEveningQty: e.target.value }))} placeholder="0" /></label>
                <label className="form-field"><span>Rate / Liter (₹)</span><input type="number" min="0" step="0.01" value={editForm.defaultRatePerLiter} onChange={(e) => setEditForm((f) => ({ ...f, defaultRatePerLiter: e.target.value }))} placeholder="0.00" /></label>
              </div>
            </div>
            <div className="supplier-form-section">
              <p className="eyebrow">Bank Details</p>
              <div className="form-grid">
                <label className="form-field"><span>Account Holder</span><input type="text" value={editForm.bankDetails.holderName} onChange={(e) => handleBankChange("holderName", e.target.value)} /></label>
                <label className="form-field"><span>Account Number</span><input type="text" value={editForm.bankDetails.accountNo} onChange={(e) => handleBankChange("accountNo", e.target.value)} /></label>
                <label className="form-field"><span>IFSC Code</span><input type="text" value={editForm.bankDetails.ifscCode} onChange={(e) => handleBankChange("ifscCode", e.target.value.toUpperCase())} /></label>
                <label className="form-field"><span>Bank Name</span><input type="text" value={editForm.bankDetails.bankName} onChange={(e) => handleBankChange("bankName", e.target.value)} /></label>
              </div>
            </div>
            <div className="supplier-form-section">
              <label className="form-field"><span>Notes</span><textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></label>
            </div>
            <div className="supplier-form-actions">
              <button className="primary-button" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
              <div className="supplier-form-actions-row">
                <button className={`mini-button ${supplier.isActive ? "warning" : "active"}`} onClick={() => { closeEdit(); setConfirmAction({ type: "toggle" }); }}>
                  {supplier.isActive ? "Deactivate" : "Activate"}
                </button>
                <button className="mini-button danger" onClick={() => { closeEdit(); setConfirmAction({ type: "delete" }); }}>Remove</button>
              </div>
            </div>
          </div>
        </BottomSheet>
      ) : (
        <Modal open={editOpen} onClose={closeEdit} title="Edit Supplier" footer={
          <div className="modal-actions">
            <button className="mini-button" onClick={closeEdit} disabled={saving}>Cancel</button>
            <button className="primary-button" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            <span className="modal-actions-sep" />
            <button className={`mini-button ${supplier.isActive ? "warning" : "active"}`} onClick={() => { closeEdit(); setConfirmAction({ type: "toggle" }); }}>
              {supplier.isActive ? "Deactivate" : "Activate"}
            </button>
            <button className="mini-button danger" onClick={() => { closeEdit(); setConfirmAction({ type: "delete" }); }}>Remove</button>
          </div>
        }>
          <div className="supplier-form">
            <div className="supplier-form-section">
              <p className="eyebrow">Basic Information</p>
              <div className="form-grid">
                <label className="form-field"><span>Name <em className="required">*</em></span><input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></label>
                <label className="form-field"><span>Phone <em className="required">*</em></span><input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} /></label>
                <label className="form-field"><span>Email</span><input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} /></label>
                <label className="form-field"><span>Location</span><input type="text" value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} /></label>
                <label className="form-field"><span>Pincode</span><input type="text" value={editForm.pincode} onChange={(e) => setEditForm((f) => ({ ...f, pincode: e.target.value }))} /></label>
                <label className="form-field"><span>Joining Date</span><input type="date" value={editForm.joiningDate} onChange={(e) => setEditForm((f) => ({ ...f, joiningDate: e.target.value }))} /></label>
              </div>
            </div>
            <div className="supplier-form-section">
              <p className="eyebrow">Collection Settings</p>
              <div className="form-grid">
                <div className="form-field full-span">
                  <span>Sessions <em className="required">*</em></span>
                  <div className="supplier-session-toggles">
                    {["morning", "evening"].map((s) => (
                      <label key={s} className="supplier-session-option"><input type="checkbox" checked={editForm.collectionSessions.includes(s)} onChange={() => handleSessionToggle(s)} /><span>{s}</span></label>
                    ))}
                  </div>
                </div>
                <label className="form-field"><span>Morning Qty (L)</span><input type="number" min="0" step="0.1" value={editForm.defaultMorningQty} onChange={(e) => setEditForm((f) => ({ ...f, defaultMorningQty: e.target.value }))} placeholder="0" /></label>
                <label className="form-field"><span>Evening Qty (L)</span><input type="number" min="0" step="0.1" value={editForm.defaultEveningQty} onChange={(e) => setEditForm((f) => ({ ...f, defaultEveningQty: e.target.value }))} placeholder="0" /></label>
                <label className="form-field"><span>Rate / Liter (₹)</span><input type="number" min="0" step="0.01" value={editForm.defaultRatePerLiter} onChange={(e) => setEditForm((f) => ({ ...f, defaultRatePerLiter: e.target.value }))} placeholder="0.00" /></label>
              </div>
            </div>
            <div className="supplier-form-section">
              <p className="eyebrow">Bank Details</p>
              <div className="form-grid">
                <label className="form-field"><span>Account Holder</span><input type="text" value={editForm.bankDetails.holderName} onChange={(e) => handleBankChange("holderName", e.target.value)} /></label>
                <label className="form-field"><span>Account Number</span><input type="text" value={editForm.bankDetails.accountNo} onChange={(e) => handleBankChange("accountNo", e.target.value)} /></label>
                <label className="form-field"><span>IFSC Code</span><input type="text" value={editForm.bankDetails.ifscCode} onChange={(e) => handleBankChange("ifscCode", e.target.value.toUpperCase())} /></label>
                <label className="form-field"><span>Bank Name</span><input type="text" value={editForm.bankDetails.bankName} onChange={(e) => handleBankChange("bankName", e.target.value)} /></label>
              </div>
            </div>
            <div className="supplier-form-section">
              <label className="form-field"><span>Notes</span><textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></label>
            </div>
          </div>
        </Modal>
      ))}

      {/* ── Confirm Collection Modal ────────────────── */}
      <Modal
        open={!!colConfirmTarget}
        onClose={() => setColConfirmTarget(null)}
        title={colConfirmTarget ? `Confirm — ${formatDate(colConfirmTarget.date)} ${colConfirmTarget.session}` : "Confirm Collection"}
        footer={
          <div className="modal-actions">
            <button className="mini-button" onClick={() => setColConfirmTarget(null)} disabled={savingConfirm}>Cancel</button>
            <button className="mini-button active" onClick={handleColConfirm} disabled={savingConfirm}>
              {savingConfirm ? "Confirming…" : "Confirm"}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Actual Qty (L) <em>*</em></span>
            <input type="number" min="0" step="0.1"
              value={colConfirmForm.actualQty}
              onChange={(e) => setColConfirmForm((f) => ({ ...f, actualQty: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Rate / Liter (₹) <em>*</em></span>
            <input type="number" min="0" step="0.01"
              value={colConfirmForm.ratePerLiter}
              onChange={(e) => setColConfirmForm((f) => ({ ...f, ratePerLiter: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Fat %</span>
            <input type="number" min="0" step="0.01"
              value={colConfirmForm.fatContent}
              onChange={(e) => setColConfirmForm((f) => ({ ...f, fatContent: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>SNF %</span>
            <input type="number" min="0" step="0.01"
              value={colConfirmForm.snf}
              onChange={(e) => setColConfirmForm((f) => ({ ...f, snf: e.target.value }))}
            />
          </label>
          <label className="form-field" style={{ gridColumn: "1 / -1" }}>
            <span>Notes</span>
            <textarea rows={2}
              value={colConfirmForm.notes}
              onChange={(e) => setColConfirmForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>
      </Modal>

      {/* ── Add Adjustment Modal ─────────────────────────── */}
      <Modal
        open={adjOpen}
        onClose={() => setAdjOpen(false)}
        title="Add Adjustment"
        footer={
          <div className="modal-actions">
            <button className="mini-button" onClick={() => setAdjOpen(false)} disabled={savingAdj}>Cancel</button>
            <button className="mini-button active" onClick={handleCreateAdjustment} disabled={savingAdj}>
              {savingAdj ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Type <em>*</em></span>
            <select value={adjForm.type} onChange={(e) => setAdjForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="debit">Debit (reduce balance)</option>
              <option value="credit">Credit (increase balance)</option>
            </select>
          </label>
          <label className="form-field">
            <span>Category <em>*</em></span>
            <select value={adjForm.category} onChange={(e) => setAdjForm((f) => ({ ...f, category: e.target.value }))}>
              <option value="advance">Advance</option>
              <option value="transport">Transport</option>
              <option value="quality_bonus">Quality Bonus</option>
              <option value="quality_penalty">Quality Penalty</option>
              <option value="rounding">Rounding</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="form-field">
            <span>Amount (₹) <em>*</em></span>
            <input type="number" min="0" step="0.01" value={adjForm.amount}
              onChange={(e) => setAdjForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
          </label>
          <label className="form-field">
            <span>Date <em>*</em></span>
            <input type="date" value={adjForm.date}
              onChange={(e) => setAdjForm((f) => ({ ...f, date: e.target.value }))} />
          </label>
          <label className="form-field" style={{ gridColumn: "1 / -1" }}>
            <span>Description <em>*</em></span>
            <input type="text" value={adjForm.description}
              onChange={(e) => setAdjForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Transport deduction for Jan week 2" />
          </label>
          <label className="form-field" style={{ gridColumn: "1 / -1" }}>
            <span>Notes</span>
            <textarea rows={2} value={adjForm.notes}
              onChange={(e) => setAdjForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
        </div>
      </Modal>

      {/* ── Edit Collection Modal ───────────────────── */}
      <Modal
        open={!!colEditTarget}
        onClose={() => setColEditTarget(null)}
        title={colEditTarget ? `Edit — ${formatDate(colEditTarget.date)} ${colEditTarget.session}` : "Edit Collection"}
        footer={
          <div className="modal-actions">
            <button className="mini-button" onClick={() => setColEditTarget(null)} disabled={savingCol}>Cancel</button>
            <button className="mini-button active" onClick={handleColSave} disabled={savingCol}>
              {savingCol ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Actual Qty (L)</span>
            <input type="number" min="0" step="0.1"
              value={colEditForm.actualQty}
              onChange={(e) => setColEditForm((f) => ({ ...f, actualQty: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Rate / Liter (₹)</span>
            <input type="number" min="0" step="0.01"
              value={colEditForm.ratePerLiter}
              onChange={(e) => setColEditForm((f) => ({ ...f, ratePerLiter: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Fat %</span>
            <input type="number" min="0" step="0.01"
              value={colEditForm.fatContent}
              onChange={(e) => setColEditForm((f) => ({ ...f, fatContent: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>SNF %</span>
            <input type="number" min="0" step="0.01"
              value={colEditForm.snf}
              onChange={(e) => setColEditForm((f) => ({ ...f, snf: e.target.value }))}
            />
          </label>
          <label className="form-field" style={{ gridColumn: "1 / -1" }}>
            <span>Notes</span>
            <textarea rows={2}
              value={colEditForm.notes}
              onChange={(e) => setColEditForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>
      </Modal>

      {/* ── Confirm Dialogs ─────────────────────────── */}
      {confirmAction?.type === "toggle" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={handleToggleStatus}
          title={supplier.isActive ? "Deactivate Supplier" : "Activate Supplier"}
          message={supplier.isActive
            ? `Deactivate ${supplier.name}? Their entries will no longer be generated in daily collections.`
            : `Activate ${supplier.name}? They will be included in future daily collection entries.`}
          confirmText={supplier.isActive ? "Deactivate" : "Activate"}
          variant={supplier.isActive ? "danger" : "active"}
        />
      )}
      {confirmAction?.type === "delete" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={handleDelete}
          title="Remove Supplier"
          message={`Remove ${supplier.name}? Their collection and payment history will be preserved but they will no longer appear in the active supplier list.`}
          confirmText="Remove"
          variant="danger"
        />
      )}
    </div>
  );
}
