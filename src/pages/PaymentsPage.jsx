import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight, IndianRupee, TrendingUp, TrendingDown,
  Eye, RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDate, todayLocal } from "../utils/format";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import PageSkeleton from "../components/ui/PageSkeleton";
import PageError from "../components/ui/PageError";
import EmptyState from "../components/ui/EmptyState";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import SearchInput from "../components/ui/SearchInput";
import { useApiData } from "../hooks/useApiData";
import { apiRequest, safeParseJson } from "../api/client";
import toast from "react-hot-toast";

/* ═══════════════════════════════════════════════════
   Data fetchers
   ═══════════════════════════════════════════════════ */

async function fetchAllCustomers() {
  const res = await apiRequest("/api/user/admin/all");
  if (!res.ok) throw new Error("Failed to fetch customers");
  const data = await res.json();
  return data.users || [];
}

async function fetchAllSuppliers() {
  const res = await apiRequest("/api/suppliers");
  if (!res.ok) throw new Error("Failed to fetch suppliers");
  const data = await res.json();
  return data.suppliers || [];
}

/* ═══════════════════════════════════════════════════
   Customer Payments Tab
   ═══════════════════════════════════════════════════ */

function CustomerPaymentsTab() {
  const { data: customers, loading, error, refetch } = useApiData(fetchAllCustomers);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all"); // all | due | advance | zero

  // Payment modal
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", transactionId: "", notes: "", date: todayLocal() });
  const [paying, setPaying] = useState(false);

  // Adjustment modal
  const [adjModal, setAdjModal] = useState(null);
  const [adjForm, setAdjForm] = useState({ adjType: "credit_adjustment", amount: "", notes: "", date: todayLocal() });
  const [adjusting, setAdjusting] = useState(false);

  // Passbook / history modal
  const [historyModal, setHistoryModal] = useState(null);
  const [passbook, setPassbook] = useState(null);
  const [passbookLoading, setPassbookLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!customers) return [];
    let list = customers;

    if (balanceFilter === "due") list = list.filter(u => u.accountBalance > 0);
    else if (balanceFilter === "advance") list = list.filter(u => u.accountBalance < 0);
    else if (balanceFilter === "zero") list = list.filter(u => !u.accountBalance);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }

    // Sort: highest balance first
    return [...list].sort((a, b) => (b.accountBalance || 0) - (a.accountBalance || 0));
  }, [customers, search, balanceFilter]);

  const stats = useMemo(() => {
    if (!customers) return { totalDue: 0, totalAdvance: 0, count: 0 };
    const totalDue = customers.reduce((s, u) => s + Math.max(0, u.accountBalance || 0), 0);
    const totalAdvance = Math.abs(customers.reduce((s, u) => s + Math.min(0, u.accountBalance || 0), 0));
    return { totalDue, totalAdvance, count: customers.length };
  }, [customers]);

  // Fetch passbook for history modal
  const fetchPassbook = useCallback(async (userId) => {
    setPassbookLoading(true);
    try {
      const res = await apiRequest(`/api/payments/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch payment history");
      const data = await res.json();
      setPassbook(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPassbookLoading(false);
    }
  }, []);

  function openHistory(user) {
    setHistoryModal(user);
    setPassbook(null);
    fetchPassbook(user._id);
  }

  async function handleRecordPayment(e) {
    if (e) e.preventDefault();
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");

    setPaying(true);
    try {
      const res = await apiRequest("/api/payments/admin/record", {
        method: "POST",
        body: JSON.stringify({ userId: payModal._id, amount, transactionId: payForm.transactionId, notes: payForm.notes, date: payForm.date }),
      });
      if (!res.ok) {
        const payload = await safeParseJson(res);
        throw new Error(payload?.message || "Failed to record payment");
      }
      toast.success("Payment recorded!");
      setPayModal(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
    }
  }

  async function handleRecordAdjustment(e) {
    if (e) e.preventDefault();
    const amount = parseFloat(adjForm.amount);
    if (!amount || amount <= 0) return toast.error("Enter a valid positive amount");

    setAdjusting(true);
    try {
      const res = await apiRequest("/api/payments/admin/record", {
        method: "POST",
        body: JSON.stringify({
          userId: adjModal._id,
          type: adjForm.adjType,
          amount,
          notes: adjForm.notes,
          date: adjForm.date,
        }),
      });
      if (!res.ok) {
        const payload = await safeParseJson(res);
        throw new Error(payload?.message || "Failed to record adjustment");
      }
      toast.success("Adjustment recorded!");
      setAdjModal(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdjusting(false);
    }
  }

  function openPayModal(user) {
    setPayModal(user);
    setPayForm({ amount: Math.max(0, user.accountBalance || 0).toString(), transactionId: "", notes: "", date: todayLocal() });
  }

  function openAdjModal(user) {
    setAdjModal(user);
    setAdjForm({ adjType: "credit_adjustment", amount: "", notes: "", date: todayLocal() });
  }

  const columns = [
    {
      key: "name", label: "Customer", render: (r) => (
        <div>
          <Link to={`/customers/${r._id}`} className="inv-customer-link"><strong>{r.name}</strong></Link>
          <div className="text-muted" style={{ fontSize: "11px" }}>{r.phone}</div>
        </div>
      ),
    },
    {
      key: "accountBalance", label: "Balance", render: (r) => (
        <strong className={r.accountBalance > 0 ? "danger-text" : r.accountBalance < 0 ? "success-text" : ""}>
          {formatCurrency(r.accountBalance)}
        </strong>
      ),
    },
    {
      key: "totalSpent", label: "Total Spent", render: (r) => (
        <span className="text-muted">{formatCurrency(r.totalSpent || 0)}</span>
      ),
    },
    {
      key: "_actions", label: "", render: (r) => (
        <div className="pay-actions-cell">
          <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); openPayModal(r); }}>
            Collect
          </button>
          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openAdjModal(r); }} title="Adjust">
            <ArrowLeftRight size={13} />
          </button>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); openHistory(r); }} title="History">
            <Eye size={13} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <PageSkeleton />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="pay-tab-content">
      {/* Summary stats */}
      <div className="pay-stats-row">
        <div className="pay-stat-card pay-stat--danger">
          <TrendingUp size={18} />
          <div>
            <span className="pay-stat-label">Total Due</span>
            <span className="pay-stat-value">{formatCurrency(stats.totalDue)}</span>
          </div>
        </div>
        <div className="pay-stat-card pay-stat--success">
          <TrendingDown size={18} />
          <div>
            <span className="pay-stat-label">Advances</span>
            <span className="pay-stat-value">{formatCurrency(stats.totalAdvance)}</span>
          </div>
        </div>
        <div className="pay-stat-card">
          <IndianRupee size={18} />
          <div>
            <span className="pay-stat-label">Customers</span>
            <span className="pay-stat-value">{stats.count}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="pay-filter-bar">
        <div className="pay-balance-chips">
          {[
            { value: "all", label: "All" },
            { value: "due", label: "Due" },
            { value: "advance", label: "Advance" },
            { value: "zero", label: "Settled" },
          ].map(opt => (
            <button
              key={opt.value}
              className={`pay-chip${balanceFilter === opt.value ? " active" : ""}`}
              onClick={() => setBalanceFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search customers..." />
        <button className="btn btn-sm pay-refresh-btn" onClick={refetch} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        emptyText="No customers match the current filters."
        renderCard={(u) => (
          <>
            <div className="mc-head">
              <div className="mc-identity">
                <span className="mc-name">{u.name}</span>
                <span className="mc-sub">{u.phone}</span>
              </div>
              <strong
                className={u.accountBalance > 0 ? "danger-text" : u.accountBalance < 0 ? "success-text" : ""}
                style={{ fontSize: "var(--font-size-lg)", whiteSpace: "nowrap" }}
              >
                {formatCurrency(u.accountBalance)}
              </strong>
            </div>
            {u.totalSpent > 0 && (
              <div className="pay-card-meta">
                <span>Total Spent: {formatCurrency(u.totalSpent)}</span>
              </div>
            )}
            <div className="inv-card-action">
              <button className="btn btn-primary btn-sm" onClick={() => openPayModal(u)}>Collect</button>
              <button className="btn btn-secondary btn-sm" onClick={() => openAdjModal(u)}>
                <ArrowLeftRight size={13} /> Adjust
              </button>
              <button className="btn btn-sm" onClick={() => openHistory(u)}>
                <Eye size={13} /> History
              </button>
            </div>
          </>
        )}
        pageSize={20}
      />

      {/* ── Payment Modal ── */}
      <ResponsiveModal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title={`Collect Payment — ${payModal?.name}`}
        footer={
          <div className="product-modal-footer-right">
            <button className="btn btn-secondary btn-sm" onClick={() => setPayModal(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleRecordPayment} disabled={paying}>
              {paying ? "Recording..." : "Record Payment"}
            </button>
          </div>
        }
      >
        <div className="form-stack">
          {payModal?.accountBalance > 0 && (
            <div className="payment-balance-banner">
              <div>
                <span className="payment-balance-label">Outstanding</span>
                <span className="payment-balance-amount">{formatCurrency(payModal.accountBalance)}</span>
              </div>
              <button type="button" className="payment-fill-btn" onClick={() => setPayForm(f => ({ ...f, amount: payModal.accountBalance.toString() }))}>Fill</button>
            </div>
          )}
          {payModal?.accountBalance < 0 && (
            <div className="payment-balance-banner" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>
              Credit of {formatCurrency(Math.abs(payModal.accountBalance))} — no collection needed.
            </div>
          )}
          <div className="form-group">
            <label>Amount (Rs)</label>
            <input type="number" min="0" step="0.01" value={payForm.amount} onChange={(e) => setPayForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={payForm.date} onChange={(e) => setPayForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Transaction ID / Ref</label>
            <input type="text" value={payForm.transactionId} onChange={(e) => setPayForm(f => ({ ...f, transactionId: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={payForm.notes} onChange={(e) => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Cash collected" rows={2} />
          </div>
        </div>
      </ResponsiveModal>

      {/* ── Adjustment Modal ── */}
      <ResponsiveModal
        open={!!adjModal}
        onClose={() => setAdjModal(null)}
        title={`Adjust Account — ${adjModal?.name}`}
        footer={
          <div className="product-modal-footer-right">
            <button className="btn btn-secondary btn-sm" onClick={() => setAdjModal(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleRecordAdjustment} disabled={adjusting}>
              {adjusting ? "Saving..." : "Save Adjustment"}
            </button>
          </div>
        }
      >
        <div className="form-stack">
          <div className="adj-type-toggle">
            <button
              type="button"
              className={`adj-type-btn${adjForm.adjType === "credit_adjustment" ? " active" : ""}`}
              onClick={() => setAdjForm(f => ({ ...f, adjType: "credit_adjustment" }))}
            >
              Credit — Add Money
            </button>
            <button
              type="button"
              className={`adj-type-btn adj-type-btn--debit${adjForm.adjType === "debit_adjustment" ? " active" : ""}`}
              onClick={() => setAdjForm(f => ({ ...f, adjType: "debit_adjustment" }))}
            >
              Debit — Add Charge
            </button>
          </div>
          <p className="adj-type-hint">
            {adjForm.adjType === "credit_adjustment"
              ? "Reduces balance — refunds, goodwill, corrections."
              : "Increases balance — missed charges, corrections."}
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>Amount (Rs)</label>
              <input type="number" min="0" step="0.01" value={adjForm.amount} onChange={(e) => setAdjForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={adjForm.date} onChange={(e) => setAdjForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea value={adjForm.notes} onChange={(e) => setAdjForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>
      </ResponsiveModal>

      {/* ── History Modal ── */}
      <ResponsiveModal
        open={!!historyModal}
        onClose={() => { setHistoryModal(null); setPassbook(null); }}
        title={`Payment History — ${historyModal?.name}`}
      >
        {passbookLoading ? (
          <div className="tab-loading">Loading history...</div>
        ) : !passbook || (passbook.entries || []).length === 0 ? (
          <EmptyState text="No payment history found." />
        ) : (
          <div className="pay-history-list">
            <div className="pay-history-balance">
              Balance: <strong className={passbook.user?.accountBalance > 0 ? "danger-text" : "success-text"}>
                {formatCurrency(passbook.user?.accountBalance || 0)}
              </strong>
            </div>
            {passbook.entries.map((entry) => (
              <div key={entry._id} className="pay-history-item">
                <div className="pay-history-main">
                  <div className="pay-history-desc">
                    <strong>{entry.description || entry.type}</strong>
                    <span className="text-muted">
                      {formatDate(entry.date)}
                      {entry.category ? ` · ${entry.category}` : ""}
                      {entry.recordedBy ? ` · by ${entry.recordedBy}` : ""}
                    </span>
                  </div>
                  <span className={`pay-history-amount ${entry.type === "credit" ? "success-text" : "danger-text"}`}>
                    {entry.type === "credit" ? "+" : "-"}{formatCurrency(entry.amount)}
                  </span>
                </div>
                {(entry.notes || entry.transactionId) && (
                  <div className="pay-history-meta">
                    {entry.transactionId && <span>Ref: {entry.transactionId}</span>}
                    {entry.notes && <span>{entry.notes}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ResponsiveModal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Supplier Payments Tab
   ═══════════════════════════════════════════════════ */

function SupplierPaymentsTab() {
  const { data: suppliers, loading, error, refetch } = useApiData(fetchAllSuppliers);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");

  // Payment modal
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", fromDate: "", toDate: "", paymentMethod: "cash", transactionRef: "", notes: "" });
  const [savingPayment, setSavingPayment] = useState(false);
  const [periodTotal, setPeriodTotal] = useState(null);

  // Passbook / history modal
  const [historyModal, setHistoryModal] = useState(null);
  const [passbook, setPassbook] = useState(null);
  const [passbookLoading, setPassbookLoading] = useState(false);

  // Adjustment modal
  const [adjModal, setAdjModal] = useState(null);
  const [adjForm, setAdjForm] = useState({ type: "debit", category: "other", amount: "", date: todayLocal(), description: "", notes: "" });
  const [savingAdj, setSavingAdj] = useState(false);

  const filtered = useMemo(() => {
    if (!suppliers) return [];
    let list = suppliers.filter(s => s.isActive !== false);

    if (balanceFilter === "due") list = list.filter(s => (s.outstandingAmount || 0) > 0);
    else if (balanceFilter === "settled") list = list.filter(s => (s.outstandingAmount || 0) <= 0);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.location?.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => (b.outstandingAmount || 0) - (a.outstandingAmount || 0));
  }, [suppliers, search, balanceFilter]);

  const stats = useMemo(() => {
    if (!suppliers) return { totalDue: 0, totalPaid: 0, count: 0 };
    const active = suppliers.filter(s => s.isActive !== false);
    const totalDue = active.reduce((s, u) => s + Math.max(0, u.outstandingAmount || 0), 0);
    const totalPaid = active.reduce((s, u) => s + (u.amountPaid || 0), 0);
    return { totalDue, totalPaid, count: active.length };
  }, [suppliers]);

  const fetchPeriodTotal = useCallback(async (supplierId, fromDate, toDate) => {
    if (!fromDate || !toDate) { setPeriodTotal(null); return; }
    try {
      const params = new URLSearchParams({ supplierId, from: fromDate, to: toDate });
      const res = await apiRequest(`/api/supplier-payments/collection-total?${params}`);
      const data = await res.json();
      if (res.ok) {
        setPeriodTotal(data);
        if (data.collectionTotal > 0) {
          setPayForm(f => ({ ...f, amount: data.collectionTotal.toFixed(2) }));
        }
      }
    } catch { setPeriodTotal(null); }
  }, []);

  function openPayModal(supplier) {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const toDate = yest.toISOString().split("T")[0];
    setPeriodTotal(null);
    setPayForm({ amount: "", fromDate: "", toDate, paymentMethod: "cash", transactionRef: "", notes: "" });
    setPayModal(supplier);
  }

  async function handleRecordPayment() {
    if (!payForm.fromDate || !payForm.toDate) return toast.error("From and To dates are required");
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");

    setSavingPayment(true);
    try {
      const res = await apiRequest("/api/supplier-payments", {
        method: "POST",
        body: JSON.stringify({
          supplierId: payModal._id,
          amount,
          fromDate: payForm.fromDate,
          toDate: payForm.toDate,
          paymentMethod: payForm.paymentMethod,
          transactionRef: payForm.transactionRef,
          notes: payForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      let msg = data.message || "Payment recorded!";
      if (data.adjustment) {
        const adj = data.adjustment;
        msg += ` ${adj.type === "credit" ? "+" : "-"}${formatCurrency(adj.amount)} auto-adjusted.`;
      }
      toast.success(msg);
      setPayModal(null);
      setPeriodTotal(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPayment(false);
    }
  }

  function openHistory(supplier) {
    setHistoryModal(supplier);
    setPassbook(null);
    setPassbookLoading(true);
    apiRequest(`/api/suppliers/${supplier._id}/passbook`)
      .then(r => { if (!r.ok) throw new Error("Failed to load passbook"); return r.json(); })
      .then(data => setPassbook(data))
      .catch(err => toast.error(err.message || "Failed to load passbook"))
      .finally(() => setPassbookLoading(false));
  }

  function openAdjModal(supplier) {
    setAdjModal(supplier);
    setAdjForm({ type: "debit", category: "other", amount: "", date: todayLocal(), description: "", notes: "" });
  }

  async function handleCreateAdjustment() {
    const amount = parseFloat(adjForm.amount);
    if (!amount || !adjForm.description || !adjForm.date) return toast.error("Amount, date, and description are required");

    setSavingAdj(true);
    try {
      const res = await apiRequest(`/api/suppliers/${adjModal._id}/adjustments`, {
        method: "POST",
        body: JSON.stringify({ ...adjForm, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Adjustment recorded!");
      setAdjModal(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingAdj(false);
    }
  }

  const columns = [
    {
      key: "name", label: "Supplier", render: (r) => (
        <div>
          <Link to={`/suppliers/${r._id}`} className="inv-customer-link"><strong>{r.name}</strong></Link>
          <div className="text-muted" style={{ fontSize: "11px" }}>{r.phone}{r.location ? ` · ${r.location}` : ""}</div>
        </div>
      ),
    },
    {
      key: "outstandingAmount", label: "Outstanding", render: (r) => (
        <strong className={r.outstandingAmount > 0 ? "danger-text" : "success-text"}>
          {formatCurrency(r.outstandingAmount || 0)}
        </strong>
      ),
    },
    {
      key: "amountPaid", label: "Total Paid", render: (r) => (
        <span className="text-muted">{formatCurrency(r.amountPaid || 0)}</span>
      ),
    },
    {
      key: "_actions", label: "", render: (r) => (
        <div className="pay-actions-cell">
          <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); openPayModal(r); }}>
            Pay
          </button>
          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openAdjModal(r); }} title="Adjust">
            <ArrowLeftRight size={13} />
          </button>
          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); openHistory(r); }} title="Passbook">
            <Eye size={13} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <PageSkeleton />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="pay-tab-content">
      {/* Summary stats */}
      <div className="pay-stats-row">
        <div className="pay-stat-card pay-stat--danger">
          <TrendingUp size={18} />
          <div>
            <span className="pay-stat-label">To Pay</span>
            <span className="pay-stat-value">{formatCurrency(stats.totalDue)}</span>
          </div>
        </div>
        <div className="pay-stat-card pay-stat--success">
          <TrendingDown size={18} />
          <div>
            <span className="pay-stat-label">Total Paid</span>
            <span className="pay-stat-value">{formatCurrency(stats.totalPaid)}</span>
          </div>
        </div>
        <div className="pay-stat-card">
          <IndianRupee size={18} />
          <div>
            <span className="pay-stat-label">Suppliers</span>
            <span className="pay-stat-value">{stats.count}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="pay-filter-bar">
        <div className="pay-balance-chips">
          {[
            { value: "all", label: "All" },
            { value: "due", label: "Unpaid" },
            { value: "settled", label: "Settled" },
          ].map(opt => (
            <button
              key={opt.value}
              className={`pay-chip${balanceFilter === opt.value ? " active" : ""}`}
              onClick={() => setBalanceFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers..." />
        <button className="btn btn-sm pay-refresh-btn" onClick={refetch} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        emptyText="No suppliers match the current filters."
        renderCard={(s) => (
          <>
            <div className="mc-head">
              <div className="mc-identity">
                <span className="mc-name">{s.name}</span>
                <span className="mc-sub">{s.phone}{s.location ? ` · ${s.location}` : ""}</span>
              </div>
              <strong
                className={s.outstandingAmount > 0 ? "danger-text" : "success-text"}
                style={{ fontSize: "var(--font-size-lg)", whiteSpace: "nowrap" }}
              >
                {formatCurrency(s.outstandingAmount || 0)}
              </strong>
            </div>
            {(s.amountPaid || 0) > 0 && (
              <div className="pay-card-meta">
                <span>Total Paid: {formatCurrency(s.amountPaid)}</span>
              </div>
            )}
            <div className="inv-card-action">
              <button className="btn btn-primary btn-sm" onClick={() => openPayModal(s)}>Pay</button>
              <button className="btn btn-secondary btn-sm" onClick={() => openAdjModal(s)}>
                <ArrowLeftRight size={13} /> Adjust
              </button>
              <button className="btn btn-sm" onClick={() => openHistory(s)}>
                <Eye size={13} /> Passbook
              </button>
            </div>
          </>
        )}
        pageSize={20}
      />

      {/* ── Record Payment Modal ── */}
      <ResponsiveModal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title={`Pay Supplier — ${payModal?.name}`}
        footer={
          <div className="product-modal-footer-right">
            <button className="btn btn-secondary btn-sm" onClick={() => setPayModal(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleRecordPayment} disabled={savingPayment}>
              {savingPayment ? "Saving..." : "Record Payment"}
            </button>
          </div>
        }
      >
        <div className="form-stack">
          {payModal?.outstandingAmount > 0 && (
            <div className="payment-balance-banner">
              <div>
                <span className="payment-balance-label">Outstanding</span>
                <span className="payment-balance-amount">{formatCurrency(payModal.outstandingAmount)}</span>
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>From Date <em className="required">*</em></label>
              <input
                type="date"
                value={payForm.fromDate}
                onChange={(e) => {
                  const fromDate = e.target.value;
                  setPayForm(f => ({ ...f, fromDate }));
                  if (payModal) fetchPeriodTotal(payModal._id, fromDate, payForm.toDate);
                }}
              />
            </div>
            <div className="form-group">
              <label>To Date <em className="required">*</em></label>
              <input
                type="date"
                value={payForm.toDate}
                onChange={(e) => {
                  const toDate = e.target.value;
                  setPayForm(f => ({ ...f, toDate }));
                  if (payModal) fetchPeriodTotal(payModal._id, payForm.fromDate, toDate);
                }}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Amount (Rs) <em className="required">*</em></label>
            <input
              type="number" min="0" step="0.01"
              value={payForm.amount}
              onChange={(e) => setPayForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
            />
            {periodTotal && (
              <span className="form-help">
                Collections in period: {formatCurrency(periodTotal.collectionTotal)} ({periodTotal.collectionCount} entries)
                {payForm.amount && Math.abs(parseFloat(payForm.amount || 0) - periodTotal.collectionTotal) > 0.01
                  ? (() => {
                      const diff = parseFloat(payForm.amount || 0) - periodTotal.collectionTotal;
                      return ` · Diff: ${diff > 0 ? "-" : "+"}${formatCurrency(Math.abs(diff))} (auto-adjusted)`;
                    })()
                  : ""}
              </span>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Method</label>
              <select value={payForm.paymentMethod} onChange={(e) => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
              </select>
            </div>
            <div className="form-group">
              <label>Reference</label>
              <input type="text" value={payForm.transactionRef} onChange={(e) => setPayForm(f => ({ ...f, transactionRef: e.target.value }))} placeholder="Txn ID, cheque #" />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={payForm.notes} onChange={(e) => setPayForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>
      </ResponsiveModal>

      {/* ── Adjustment Modal ── */}
      <ResponsiveModal
        open={!!adjModal}
        onClose={() => setAdjModal(null)}
        title={`Adjust — ${adjModal?.name}`}
        footer={
          <div className="product-modal-footer-right">
            <button className="btn btn-secondary btn-sm" onClick={() => setAdjModal(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleCreateAdjustment} disabled={savingAdj}>
              {savingAdj ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        <div className="form-stack">
          <div className="form-row">
            <div className="form-group">
              <label>Type <em className="required">*</em></label>
              <select value={adjForm.type} onChange={(e) => setAdjForm(f => ({ ...f, type: e.target.value }))}>
                <option value="debit">Debit (reduce balance)</option>
                <option value="credit">Credit (increase balance)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={adjForm.category} onChange={(e) => setAdjForm(f => ({ ...f, category: e.target.value }))}>
                <option value="advance">Advance</option>
                <option value="transport">Transport</option>
                <option value="quality_bonus">Quality Bonus</option>
                <option value="quality_penalty">Quality Penalty</option>
                <option value="rounding">Rounding</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Amount (Rs) <em className="required">*</em></label>
              <input type="number" min="0" step="0.01" value={adjForm.amount} onChange={(e) => setAdjForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Date <em className="required">*</em></label>
              <input type="date" value={adjForm.date} onChange={(e) => setAdjForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Description <em className="required">*</em></label>
            <input type="text" value={adjForm.description} onChange={(e) => setAdjForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Transport deduction" />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={adjForm.notes} onChange={(e) => setAdjForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>
      </ResponsiveModal>

      {/* ── Passbook Modal ── */}
      <ResponsiveModal
        open={!!historyModal}
        onClose={() => { setHistoryModal(null); setPassbook(null); }}
        title={`Passbook — ${historyModal?.name}`}
      >
        {passbookLoading ? (
          <div className="tab-loading">Loading passbook...</div>
        ) : !passbook || (passbook.entries || []).length === 0 ? (
          <EmptyState text="No passbook entries yet." />
        ) : (
          <div className="pay-history-list">
            <div className="pay-history-balance">
              Passbook Balance: <strong className={(passbook.supplier?.passbookBalance || 0) > 0 ? "danger-text" : "success-text"}>
                {formatCurrency(passbook.supplier?.passbookBalance || 0)}
              </strong>
            </div>
            {passbook.entries.map((entry) => (
              <div key={entry._id} className="pay-history-item">
                <div className="pay-history-main">
                  <div className="pay-history-desc">
                    <strong>{entry.description}</strong>
                    <span className="text-muted">
                      {formatDate(entry.date)}
                      {entry.category ? ` · ${entry.category.replace("_", " ")}` : ""}
                    </span>
                  </div>
                  <span className={`pay-history-amount ${entry.type === "credit" ? "success-text" : "danger-text"}`}>
                    {entry.type === "credit" ? "+" : "-"}{formatCurrency(entry.amount)}
                  </span>
                </div>
                {entry.notes && <div className="pay-history-meta"><span>{entry.notes}</span></div>}
              </div>
            ))}
          </div>
        )}
      </ResponsiveModal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Payments Page
   ═══════════════════════════════════════════════════ */

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState("customers");

  return (
    <div className="payments-page view-stack">
      <PageHeader title="Payments" subtitle="Manage all payment & financial activities" />

      {/* Top-level tabs */}
      <div className="pay-top-tabs">
        <button
          className={`pay-top-tab${activeTab === "customers" ? " active" : ""}`}
          onClick={() => setActiveTab("customers")}
        >
          Customers
        </button>
        <button
          className={`pay-top-tab${activeTab === "suppliers" ? " active" : ""}`}
          onClick={() => setActiveTab("suppliers")}
        >
          Suppliers
        </button>
      </div>

      {activeTab === "customers" ? <CustomerPaymentsTab /> : <SupplierPaymentsTab />}
    </div>
  );
}
