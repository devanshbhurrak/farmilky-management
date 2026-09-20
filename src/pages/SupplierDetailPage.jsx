import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Pencil, ChevronDown, SquarePen, Trash2, Phone, Mail, MapPin, Calendar, IndianRupee, BookOpen, Droplets, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import StatusTag from "../components/ui/StatusTag";
import LoadingScreen from "../components/ui/LoadingScreen";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";


const NOW = new Date();

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
  const [selectedMonth, setSelectedMonth] = useState({
    month: NOW.getMonth() + 1,
    year: NOW.getFullYear(),
  });
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionTotals, setCollectionTotals] = useState({ liters: 0, amount: 0 });

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
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [deletingAdjId, setDeletingAdjId] = useState(null);

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
      const firstDay = new Date(selectedMonth.year, selectedMonth.month - 1, 1);
      const lastDay  = new Date(selectedMonth.year, selectedMonth.month, 0);
      const from = firstDay.toISOString().split("T")[0];
      const to   = lastDay.toISOString().split("T")[0];
      const params = new URLSearchParams({ supplierId: id, limit: "200", from, to });
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
  }, [id, selectedMonth]);

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

  // Re-fetch collections when month changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCollectionsRef.current(); }, [selectedMonth]);

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
        if (data.grandTotal > 0) {
          setPaymentForm((f) => ({ ...f, amount: data.grandTotal.toFixed(2) }));
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
    if (deletingAdjId) return;
    setDeletingAdjId(adjId);
    try {
      const res = await apiRequest(`/api/suppliers/${id}/adjustments/${adjId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Adjustment deleted.");
      fetchPassbook();
      fetchSupplier();
    } catch (err) {
      toast.error(err.message || "Failed to delete adjustment.");
    } finally {
      setDeletingAdjId(null);
    }
  }, [id, deletingAdjId, fetchPassbook, fetchSupplier]);

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
    if (confirmLoading) return;
    setConfirmLoading(true);
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
    finally { setConfirmLoading(false); }
  }, [id, supplier, confirmAction, confirmLoading, fetchSupplier]);

  const handleDelete = useCallback(async () => {
    if (!confirmAction || confirmAction.type !== "delete") return;
    if (confirmLoading) return;
    setConfirmLoading(true);
    try {
      const res = await apiRequest(`/api/suppliers/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success(result.message);
      setConfirmAction(null);
      navigate("/suppliers");
    } catch (err) { toast.error(err.message); }
    finally { setConfirmLoading(false); }
  }, [id, confirmAction, confirmLoading, navigate]);

  const isCurrentMonth =
    selectedMonth.month === NOW.getMonth() + 1 &&
    selectedMonth.year === NOW.getFullYear();

  const monthLabel = new Date(selectedMonth.year, selectedMonth.month - 1, 1).toLocaleString("default", {
    month: "long", year: "numeric",
  });

  function goPrevMonth() {
    setSelectedMonth((prev) =>
      prev.month === 1 ? { month: 12, year: prev.year - 1 } : { ...prev, month: prev.month - 1 }
    );
  }

  function goNextMonth() {
    if (isCurrentMonth) return;
    setSelectedMonth((prev) =>
      prev.month === 12 ? { month: 1, year: prev.year + 1 } : { ...prev, month: prev.month + 1 }
    );
  }

  if (loading) return <LoadingScreen />;
  if (!supplier) {
    return (
      <EmptyState
        text="Supplier not found."
        action={<button className="btn btn-sm" onClick={() => navigate("/suppliers")}>Back to Suppliers</button>}
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

      {/* ── Hero ─────────────────────────────────────── */}
      <div className="supplier-hero panel">

        {/* ── Identity row ── */}
        <div className="sh-identity">
          <div className={`sh-avatar${!supplier.isActive ? " sh-avatar--inactive" : ""}`}>
            {supplier.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="sh-info">
            <div className="sh-name-row">
              <span className="sh-name">{supplier.name}</span>
              <StatusTag value={supplier.isActive ? "active" : "inactive"} />
            </div>
            <div className="sh-contact">
              <span className="sh-contact-item"><Phone size={11} />{supplier.phone}</span>
              {supplier.email && <span className="sh-contact-item"><Mail size={11} />{supplier.email}</span>}
              {supplier.location && (
                <span className="sh-contact-item">
                  <MapPin size={11} />{supplier.location}{supplier.pincode ? ` · ${supplier.pincode}` : ""}
                </span>
              )}
              {supplier.joiningDate && (
                <span className="sh-contact-item"><Calendar size={11} />Since {formatDate(supplier.joiningDate)}</span>
              )}
            </div>
          </div>
          <button className="supplier-card-edit-btn sh-edit-btn" onClick={openEdit} aria-label="Edit supplier">
            <Pencil size={14} />
          </button>
        </div>

        {/* ── Balance strip ── */}
        <div className="sh-balance-strip">
          <div className={`sh-balance-item sh-balance-item--outstanding${supplier.outstandingAmount > 0 ? " sh-balance-item--due" : ""}`}>
            <span className="sh-balance-label">Outstanding</span>
            <strong className="sh-balance-value">{formatCurrency(supplier.outstandingAmount)}</strong>
          </div>
          <div className="sh-balance-item">
            <span className="sh-balance-label">Supply</span>
            <strong className="sh-balance-value">{formatCurrency(supplier.supplyBalance)}</strong>
          </div>
          <div className="sh-balance-item">
            <span className="sh-balance-label">Passbook</span>
            <strong className="sh-balance-value">{formatCurrency(supplier.passbookBalance)}</strong>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="sh-kpi-strip">
          <div className="sh-kpi">
            <span className="sh-kpi-label">Rate / L</span>
            <strong className="sh-kpi-value">₹{Number(supplier.defaultRatePerLiter || 0).toFixed(2)}</strong>
          </div>
          <div className="sh-kpi">
            <span className="sh-kpi-label">Sessions</span>
            <strong className="sh-kpi-value" style={{ textTransform: "capitalize" }}>
              {(supplier.collectionSessions || []).join(" & ") || "—"}
            </strong>
          </div>
          {supplier.collectionSessions?.includes("morning") && (
            <div className="sh-kpi">
              <span className="sh-kpi-label">Morning</span>
              <strong className="sh-kpi-value">{supplier.defaultMorningQty ?? 0} L</strong>
            </div>
          )}
          {supplier.collectionSessions?.includes("evening") && (
            <div className="sh-kpi">
              <span className="sh-kpi-label">Evening</span>
              <strong className="sh-kpi-value">{supplier.defaultEveningQty ?? 0} L</strong>
            </div>
          )}
        </div>

        {/* ── Bank details ── */}
        {hasBankDetails && (
          <div className="sh-bank">
            <div className="sh-bank-row">
              {supplier.bankDetails.holderName && (
                <div className="sh-bank-item"><span>Holder</span><strong>{supplier.bankDetails.holderName}</strong></div>
              )}
              {supplier.bankDetails.bankName && (
                <div className="sh-bank-item"><span>Bank</span><strong>{supplier.bankDetails.bankName}</strong></div>
              )}
              {supplier.bankDetails.accountNo && (
                <div className="sh-bank-item"><span>Account</span><strong>{supplier.bankDetails.accountNo}</strong></div>
              )}
              {supplier.bankDetails.ifscCode && (
                <div className="sh-bank-item"><span>IFSC</span><strong>{supplier.bankDetails.ifscCode}</strong></div>
              )}
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        {supplier.notes && (
          <p className="sh-notes">{supplier.notes}</p>
        )}

      </div>

      {/* ── Month selector ───────────────────────────── */}
      <div className="month-selector">
        <button className="month-selector-nav" onClick={goPrevMonth} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span className="month-selector-label">
          <Calendar size={13} />
          {monthLabel}
          {isCurrentMonth && <span className="month-selector-current">This Month</span>}
        </span>
        <button className="month-selector-nav" onClick={goNextMonth} disabled={isCurrentMonth} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Monthly metrics ──────────────────────────── */}
      <div className="customer-metrics">
        <div className="customer-metric-card metric-success">
          <div className="customer-metric-header">
            <span className="customer-metric-label">Liters Collected</span>
          </div>
          <span className="customer-metric-value">
            {Number(collectionTotals.liters).toFixed(1)} <small>L</small>
          </span>
        </div>
        <div className="customer-metric-card metric-info">
          <div className="customer-metric-header">
            <span className="customer-metric-label">Amount Earned</span>
          </div>
          <span className="customer-metric-value">{formatCurrency(collectionTotals.amount)}</span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────── */}
      <div className="customer-tabs-panel">
        <div className="customer-tabs-header" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "collections"}
            className={`customer-tab-btn ${activeTab === "collections" ? "active" : ""}`}
            onClick={() => setActiveTab("collections")}
          >
            <Droplets size={14} /> Collections
            {collections.length > 0 && <span className="customer-tab-count">{collections.length}</span>}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "payments"}
            className={`customer-tab-btn ${activeTab === "payments" ? "active" : ""}`}
            onClick={() => setActiveTab("payments")}
          >
            <IndianRupee size={14} /> Payments
            {payments.length > 0 && <span className="customer-tab-count">{payments.length}</span>}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "passbook"}
            className={`customer-tab-btn ${activeTab === "passbook" ? "active" : ""}`}
            onClick={() => setActiveTab("passbook")}
          >
            <BookOpen size={14} /> Passbook
          </button>
        </div>

        <div className="customer-tab-body" role="tabpanel">

        {/* ── Collections Tab ──────────────────────── */}
        {activeTab === "collections" && (
          <div className="tab-content">

            {collectionsLoading ? (
              <div className="tab-loading">Loading collections…</div>
            ) : collections.length === 0 ? (
              <EmptyState text="No collections found for this period." />
            ) : isMobile ? (
              /* ── Mobile: collection cards ── */
              <div className="sc2-list">
                {collections.map((c) => {
                  const isPending = c.status === "pending";
                  const isPaid    = !!c.paymentId;
                  const amount    = c.totalAmount != null
                    ? formatCurrency(c.totalAmount)
                    : c.expectedQty && c.ratePerLiter
                      ? formatCurrency(c.expectedQty * c.ratePerLiter)
                      : null;
                  const qty = c.actualQty != null
                    ? `${c.actualQty} L`
                    : c.expectedQty != null ? `~${c.expectedQty} L` : "—";
                  return (
                    <div key={c._id} className={`sc2-card sc2-card--${c.status}${isPaid ? " sc2-card--paid" : ""}`}>
                      <div className="sc2-body">
                        <div className="sc2-left">
                          <span className="sc2-date">{formatDate(c.date)}</span>
                          <div className="sc2-sub">
                            <span className={`sc2-session sc2-session--${c.session}`}>{c.session}</span>
                            <span className="sc2-dot">·</span>
                            <span className="sc2-meta-val">{qty}</span>
                            <span className="sc2-dot">·</span>
                            <span className="sc2-meta-val">{c.ratePerLiter != null ? `₹${Number(c.ratePerLiter).toFixed(2)}/L` : "—"}</span>
                          </div>
                        </div>
                        <div className="sc2-right">
                          <div className="sc2-right-top">
                            {amount && (
                              <span className={`sc2-amount${isPending ? " sc2-amount--est" : ""}`}>{amount}</span>
                            )}
                            {isPending
                              ? <button className="sc2-confirm-btn" onClick={() => openColConfirm(c)}>Confirm</button>
                              : <button className="supplier-card-edit-btn" onClick={() => openColEdit(c)} title="Edit"><SquarePen size={13} /></button>
                            }
                          </div>
                          {!isPending && (
                            <div className="sc2-right-bottom">
                              <span className={`sc2-pay-badge ${isPaid ? "sc2-pay-badge--paid" : "sc2-pay-badge--unpaid"}`}>
                                {isPaid ? "Paid" : "Unpaid"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                            ? <button className="btn btn-sm active" style={{ fontSize: "11px", padding: "2px 10px" }} onClick={() => openColConfirm(c)}>Confirm</button>
                            : <button className="supplier-card-edit-btn" onClick={() => openColEdit(c)} title="Edit"><SquarePen size={14} /></button>
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
                className="btn btn-primary"
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
              <div className="sc2-list">
                {payments.map((p) => (
                  <div key={p._id} className="sp2-card">
                    <div className="sp2-body">
                      <div className="sp2-left">
                        <span className="sp2-amount">{formatCurrency(p.amount)}</span>
                        <div className="sp2-sub">
                          <span className="sp2-method">{p.paymentMethod?.replace("_", " ")}</span>
                          <span className="sc2-dot">·</span>
                          <span className="sc2-meta-val">{formatDate(p.fromDate)} – {formatDate(p.toDate)}</span>
                        </div>
                      </div>
                      <div className="sp2-right">
                        <span className="sc2-meta-val">{formatDate(p.paidAt)}</span>
                        <div className="sp2-sub">
                          <span className="sc2-meta-val">{p.collectionCount} collections</span>
                          {p.transactionRef && <>
                            <span className="sc2-dot">·</span>
                            <span className="sc2-meta-val sp2-ref">{p.transactionRef}</span>
                          </>}
                        </div>
                      </div>
                    </div>
                    {p.recordedBy?.name && (
                      <div className="sp2-by">by {p.recordedBy.name}</div>
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
              <button className="btn btn-primary" onClick={() => setAdjOpen(true)}>
                Add Adjustment
              </button>
            </div>
            {passbookLoading ? (
              <div className="tab-loading">Loading passbook…</div>
            ) : !passbookData || passbookData.entries.length === 0 ? (
              <EmptyState text="No passbook entries yet." />
            ) : (
              <div className="sc2-list">
                {passbookData.entries.map((entry) => (
                  <div key={entry._id} className={`pb-card pb-card--${entry.type}`}>
                    <div className="pb-body">
                      <div className="pb-left">
                        <span className="pb-desc">{entry.description}</span>
                        <div className="sp2-sub">
                          <span className="sc2-meta-val">{formatDate(entry.date)}</span>
                          {entry.category && <>
                            <span className="sc2-dot">·</span>
                            <span className="sc2-meta-val" style={{ textTransform: "capitalize" }}>{entry.category.replace("_", " ")}</span>
                          </>}
                          {(entry.isAuto || entry.isSettled) && <>
                            <span className="sc2-dot">·</span>
                            <span className="sc2-meta-val">{entry.isAuto ? "auto" : "settled"}</span>
                          </>}
                        </div>
                      </div>
                      <div className="pb-right">
                        <span className={`pb-amount pb-amount--${entry.type}`}>
                          {entry.type === "credit" ? "+" : "−"}{formatCurrency(entry.amount)}
                        </span>
                        {!entry.isAuto && !entry.isSettled && (
                          <button
                            className="supplier-card-edit-btn"
                            onClick={() => handleDeleteAdjustment(entry._id)}
                            disabled={deletingAdjId === entry._id}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ── Record Payment Modal ─────────────────────── */}
      <ResponsiveModal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        title="Record Payment"
        footer={
          <div className="modal-actions">
            <button className="btn btn-sm" onClick={() => setPaymentModal(false)} disabled={savingPayment}>
              Cancel
            </button>
            <button className="btn btn-sm active" onClick={handleRecordPayment} disabled={savingPayment}>
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
              inputMode="decimal"
              min="0"
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
            />
            {periodTotal && (
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                Collections: {formatCurrency(periodTotal.collectionTotal)} ({periodTotal.collectionCount} entries)
                {periodTotal.adjustmentCount > 0 && (
                  <> · Passbook: {periodTotal.adjustmentNet >= 0 ? "+" : ""}{formatCurrency(periodTotal.adjustmentNet)} ({periodTotal.adjustmentCount} entries)</>
                )}
                {" · "}Expected: {formatCurrency(periodTotal.grandTotal)}
                {paymentForm.amount && Math.abs(parseFloat(paymentForm.amount || 0) - periodTotal.grandTotal) > 0.01
                  ? (() => {
                      const diff = parseFloat(paymentForm.amount || 0) - periodTotal.grandTotal;
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
      </ResponsiveModal>

      {/* ── Edit Supplier Modal / Sheet ─────────────── */}
      {editForm && (
        <ResponsiveModal
          open={editOpen}
          onClose={closeEdit}
          title="Edit Supplier"
          footer={
            <div className="supp-edit-footer-primary">
              <button className="btn btn-sm" onClick={closeEdit} disabled={saving}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          }
        >
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
                <label className="form-field"><span>Morning Qty (L)</span><input type="number" inputMode="decimal" min="0" step="0.1" value={editForm.defaultMorningQty} onChange={(e) => setEditForm((f) => ({ ...f, defaultMorningQty: e.target.value }))} placeholder="0" /></label>
                <label className="form-field"><span>Evening Qty (L)</span><input type="number" inputMode="decimal" min="0" step="0.1" value={editForm.defaultEveningQty} onChange={(e) => setEditForm((f) => ({ ...f, defaultEveningQty: e.target.value }))} placeholder="0" /></label>
                <label className="form-field"><span>Rate / Liter (₹)</span><input type="number" inputMode="decimal" min="0" step="0.01" value={editForm.defaultRatePerLiter} onChange={(e) => setEditForm((f) => ({ ...f, defaultRatePerLiter: e.target.value }))} placeholder="0.00" /></label>
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
            <div className="supp-edit-danger-row">
              <button className={`btn btn-sm ${supplier.isActive ? "warning" : "active"}`} onClick={() => { closeEdit(); setConfirmAction({ type: "toggle" }); }}>
                {supplier.isActive ? "Deactivate" : "Activate"}
              </button>
              <button className="btn btn-sm danger" onClick={() => { closeEdit(); setConfirmAction({ type: "delete" }); }}>Remove</button>
            </div>
          </div>
        </ResponsiveModal>
      )}

      {/* ── Confirm Collection Modal ────────────────── */}
      <ResponsiveModal
        open={!!colConfirmTarget}
        onClose={() => setColConfirmTarget(null)}
        title={colConfirmTarget ? `Confirm — ${formatDate(colConfirmTarget.date)} ${colConfirmTarget.session}` : "Confirm Collection"}
        footer={
          <div className="modal-actions">
            <button className="btn btn-sm" onClick={() => setColConfirmTarget(null)} disabled={savingConfirm}>Cancel</button>
            <button className="btn btn-sm active" onClick={handleColConfirm} disabled={savingConfirm}>
              {savingConfirm ? "Confirming…" : "Confirm"}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Actual Qty (L) <em>*</em></span>
            <input type="number" inputMode="decimal" min="0" step="0.1"
              value={colConfirmForm.actualQty}
              onChange={(e) => setColConfirmForm((f) => ({ ...f, actualQty: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Rate / Liter (₹) <em>*</em></span>
            <input type="number" inputMode="decimal" min="0" step="0.01"
              value={colConfirmForm.ratePerLiter}
              onChange={(e) => setColConfirmForm((f) => ({ ...f, ratePerLiter: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Fat %</span>
            <input type="number" inputMode="decimal" min="0" step="0.01"
              value={colConfirmForm.fatContent}
              onChange={(e) => setColConfirmForm((f) => ({ ...f, fatContent: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>SNF %</span>
            <input type="number" inputMode="decimal" min="0" step="0.01"
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
      </ResponsiveModal>

      {/* ── Add Adjustment Modal ─────────────────────────── */}
      <ResponsiveModal
        open={adjOpen}
        onClose={() => setAdjOpen(false)}
        title="Add Adjustment"
        footer={
          <div className="modal-actions">
            <button className="btn btn-sm" onClick={() => setAdjOpen(false)} disabled={savingAdj}>Cancel</button>
            <button className="btn btn-sm active" onClick={handleCreateAdjustment} disabled={savingAdj}>
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
            <input type="number" inputMode="decimal" min="0" step="0.01" value={adjForm.amount}
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
      </ResponsiveModal>

      {/* ── Edit Collection Modal ───────────────────── */}
      <ResponsiveModal
        open={!!colEditTarget}
        onClose={() => setColEditTarget(null)}
        title={colEditTarget ? `Edit — ${formatDate(colEditTarget.date)} ${colEditTarget.session}` : "Edit Collection"}
        footer={
          <div className="modal-actions">
            <button className="btn btn-sm" onClick={() => setColEditTarget(null)} disabled={savingCol}>Cancel</button>
            <button className="btn btn-sm active" onClick={handleColSave} disabled={savingCol}>
              {savingCol ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Actual Qty (L)</span>
            <input type="number" inputMode="decimal" min="0" step="0.1"
              value={colEditForm.actualQty}
              onChange={(e) => setColEditForm((f) => ({ ...f, actualQty: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Rate / Liter (₹)</span>
            <input type="number" inputMode="decimal" min="0" step="0.01"
              value={colEditForm.ratePerLiter}
              onChange={(e) => setColEditForm((f) => ({ ...f, ratePerLiter: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Fat %</span>
            <input type="number" inputMode="decimal" min="0" step="0.01"
              value={colEditForm.fatContent}
              onChange={(e) => setColEditForm((f) => ({ ...f, fatContent: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>SNF %</span>
            <input type="number" inputMode="decimal" min="0" step="0.01"
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
      </ResponsiveModal>

      {/* ── Confirm Dialogs ─────────────────────────── */}
      {confirmAction?.type === "toggle" && (
        <ConfirmDialog
          open
          onClose={() => { if (!confirmLoading) setConfirmAction(null); }}
          onConfirm={handleToggleStatus}
          loading={confirmLoading}
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
          onClose={() => { if (!confirmLoading) setConfirmAction(null); }}
          onConfirm={handleDelete}
          loading={confirmLoading}
          title="Remove Supplier"
          message={`Remove ${supplier.name}? Their collection and payment history will be preserved but they will no longer appear in the active supplier list.`}
          confirmText="Remove"
          variant="danger"
        />
      )}

    </div>
  );
}
