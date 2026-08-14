import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";
import { formatCurrency, todayLocal } from "../utils/format";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import PageSkeleton from "../components/ui/PageSkeleton";
import PageError from "../components/ui/PageError";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import SearchInput from "../components/ui/SearchInput";
import { useApiData } from "../hooks/useApiData";
import { apiRequest, safeParseJson } from "../api/client";
import toast from "react-hot-toast";

async function fetchCustomersWithBalance() {
  const res = await apiRequest("/api/user/admin/all");
  const data = await res.json();
  return (data.users || []).filter(u => u.accountBalance !== 0);
}

function PaymentFormFields({ payModal, payForm, setPayForm }) {
  return (
    <div className="form-stack">
      {payModal?.accountBalance < 0 && (
        <div className="payment-balance-banner" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>
          <span>This customer has a credit of {formatCurrency(Math.abs(payModal.accountBalance))} — no collection needed.</span>
        </div>
      )}
      {payModal?.accountBalance > 0 && (
        <div className="payment-balance-banner">
          <div>
            <span className="payment-balance-label">Outstanding balance</span>
            <span className="payment-balance-amount">{formatCurrency(payModal.accountBalance)}</span>
          </div>
          <button type="button" className="payment-fill-btn" onClick={() => setPayForm(f => ({ ...f, amount: payModal.accountBalance }))}>Fill</button>
        </div>
      )}
      <div className="form-group">
        <label>Amount Collected (Rs)</label>
        <input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Date</label>
        <input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Transaction ID / Ref</label>
        <input type="text" value={payForm.transactionId} onChange={(e) => setPayForm({ ...payForm, transactionId: e.target.value })} placeholder="Optional" />
      </div>
      <div className="form-group">
        <label>Notes</label>
        <textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="e.g. Cash collected" />
      </div>
    </div>
  );
}

function AdjustmentFormFields({ adjForm, setAdjForm }) {
  return (
    <div className="form-stack">
      <div className="adj-type-toggle">
        <button
          type="button"
          className={`adj-type-btn${adjForm.adjType === "credit_adjustment" ? " active" : ""}`}
          onClick={() => setAdjForm((f) => ({ ...f, adjType: "credit_adjustment" }))}
        >
          Credit — Add Money
        </button>
        <button
          type="button"
          className={`adj-type-btn adj-type-btn--debit${adjForm.adjType === "debit_adjustment" ? " active" : ""}`}
          onClick={() => setAdjForm((f) => ({ ...f, adjType: "debit_adjustment" }))}
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
          <label>Amount (₹)</label>
          <input type="number" value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} min="0" step="0.01" />
        </div>
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={adjForm.date} onChange={(e) => setAdjForm({ ...adjForm, date: e.target.value })} />
        </div>
      </div>
      <div className="form-group">
        <label>Notes (optional)</label>
        <textarea value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} placeholder="Any additional details" rows={2} />
      </div>
    </div>
  );
}

export default function BalancesPage() {
  const { data, loading, error, refetch } = useApiData(fetchCustomersWithBalance);
  const [search, setSearch] = useState("");
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", transactionId: "", notes: "", date: todayLocal() });
  const [paying, setPaying] = useState(false);

  const [adjModal, setAdjModal] = useState(null);
  const [adjForm, setAdjForm] = useState({ adjType: "credit_adjustment", amount: "", notes: "", date: todayLocal() });
  const [adjusting, setAdjusting] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    return data.filter((u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const totalOutstanding = useMemo(() => {
    return filteredUsers.reduce((sum, u) => sum + (u.accountBalance > 0 ? u.accountBalance : 0), 0);
  }, [filteredUsers]);

  const totalAdvance = useMemo(() => {
    return Math.abs(filteredUsers.reduce((sum, u) => sum + (u.accountBalance < 0 ? u.accountBalance : 0), 0));
  }, [filteredUsers]);

  async function handleRecordPayment(e) {
    if (e) e.preventDefault();
    if (!payForm.amount || payForm.amount <= 0) return toast.error("Enter a valid amount");

    setPaying(true);
    try {
      const res = await apiRequest("/api/payments/admin/record", {
        method: "POST",
        body: JSON.stringify({ userId: payModal._id, ...payForm }),
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
    const parsedAdjAmount = parseFloat(adjForm.amount);
    if (isNaN(parsedAdjAmount) || parsedAdjAmount <= 0) return toast.error("Enter a valid positive amount");

    setAdjusting(true);
    try {
      const res = await apiRequest("/api/payments/admin/record", {
        method: "POST",
        body: JSON.stringify({
          userId: adjModal._id,
          type: adjForm.adjType,
          amount: parsedAdjAmount,
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

  const columns = [
    { key: "name", label: "Customer", render: (r) => (
      <div>
        <Link to={`/customers/${r._id}`} className="inv-customer-link">
          <strong>{r.name}</strong>
        </Link>
        <div className="text-muted" style={{ fontSize: '11px' }}>{r.phone}</div>
      </div>
    )},
    { key: "accountBalance", label: "Outstanding Balance", render: (r) => (
      <strong className={r.accountBalance > 0 ? "danger-text" : "success-text"}>
        {formatCurrency(r.accountBalance)}
      </strong>
    )},
    {
      key: "_actions",
      label: "Actions",
      render: (r) => (
        <div className="inv-actions-cell">
          <button
            className="btn btn-primary btn-sm"
            onClick={(e) => { e.stopPropagation(); setPayModal(r); setPayForm(f => ({ ...f, amount: Math.max(0, r.accountBalance) })); }}
          >
            Collect Payment
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => { e.stopPropagation(); setAdjModal(r); setAdjForm({ adjType: "credit_adjustment", amount: "", notes: "", date: todayLocal() }); }}
            title="Add manual credit or debit adjustment"
          >
            <ArrowLeftRight size={13} /> Adjust
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <PageSkeleton />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="view-stack invoices-page">
      <PageHeader
        title="Outstanding Balances"
        subtitle={`Total Debt: ${formatCurrency(totalOutstanding)} | Total Advances: ${formatCurrency(totalAdvance)}`}
      />

      <div className="surface">
        <div className="surface-filters">
          <SearchInput value={search} onChange={setSearch} placeholder="Search customers..." />
        </div>

        <DataTable
          columns={columns}
          data={filteredUsers}
          emptyText="No customers with outstanding balances found."
          renderCard={(u) => (
            <>
              <div className="mc-head">
                <div className="mc-identity">
                  <span className="mc-name">{u.name}</span>
                  <span className="mc-sub">{u.phone}</span>
                </div>
                <strong className={u.accountBalance > 0 ? "danger-text" : "success-text"} style={{ fontSize: "var(--font-size-lg)", whiteSpace: "nowrap" }}>
                  {formatCurrency(u.accountBalance)}
                </strong>
              </div>
              <div className="inv-card-action">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { setPayModal(u); setPayForm(f => ({ ...f, amount: Math.max(0, u.accountBalance) })); }}
                >
                  Collect Payment
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setAdjModal(u); setAdjForm({ adjType: "credit_adjustment", amount: "", notes: "", date: todayLocal() }); }}
                >
                  <ArrowLeftRight size={13} /> Adjust
                </button>
              </div>
            </>
          )}
          pageSize={20}
        />
      </div>

      {/* ── Payment modal ── */}
      <ResponsiveModal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title={`Collect Payment from ${payModal?.name}`}
        footer={
          <div className="product-modal-footer-right">
            <button className="btn btn-secondary btn-sm" onClick={() => setPayModal(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleRecordPayment} disabled={paying}>
              {paying ? "Recording…" : "Record Payment"}
            </button>
          </div>
        }
      >
        <PaymentFormFields payModal={payModal} payForm={payForm} setPayForm={setPayForm} />
      </ResponsiveModal>

      {/* ── Adjustment modal ── */}
      <ResponsiveModal
        open={!!adjModal}
        onClose={() => setAdjModal(null)}
        title={`Adjust Account — ${adjModal?.name}`}
        footer={
          <div className="product-modal-footer-right">
            <button className="btn btn-secondary btn-sm" onClick={() => setAdjModal(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleRecordAdjustment} disabled={adjusting}>
              {adjusting ? "Saving…" : "Save Adjustment"}
            </button>
          </div>
        }
      >
        <AdjustmentFormFields adjForm={adjForm} setAdjForm={setAdjForm} />
      </ResponsiveModal>
    </div>
  );
}
