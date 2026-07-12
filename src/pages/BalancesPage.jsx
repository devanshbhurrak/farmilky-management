import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Filter, IndianRupee } from "lucide-react";
import { formatCurrency } from "../utils/format";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import PageSkeleton from "../components/ui/PageSkeleton";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import BottomSheet from "../components/ui/BottomSheet";
import FilterSheet from "../components/ui/FilterSheet";
import { useApiData } from "../hooks/useApiData";
import { apiRequest, safeParseJson } from "../api/client";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

async function fetchCustomersWithBalance() {
  const res = await apiRequest("/api/user/admin/all");
  const data = await res.json();
  // Filter for users who owe money or are in credit
  return (data.users || []).filter(u => u.accountBalance !== 0);
}

export default function BalancesPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data, loading, error, refetch } = useApiData(fetchCustomersWithBalance);
  const [search, setSearch] = useState("");
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", transactionId: "", notes: "", date: new Date().toISOString().split("T")[0] });
  const [paying, setPaying] = useState(false);


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
        body: JSON.stringify({
          userId: payModal._id,
          ...payForm
        }),
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
        <button
          className="btn btn-primary btn-sm"
          onClick={(e) => { e.stopPropagation(); setPayModal(r); setPayForm(f => ({ ...f, amount: Math.max(0, r.accountBalance) })); }}
        >
          Collect Payment
        </button>
      ),
    },
  ];

  if (loading) return <PageSkeleton />;
  if (error) return <EmptyState text={error} action={{ label: "Retry", onClick: refetch }} />;

  return (
    <div className="view-stack invoices-page">
      <PageHeader
        title="Outstanding Balances"
        subtitle={`Total Debt: ${formatCurrency(totalOutstanding)} | Total Advances: ${formatCurrency(totalAdvance)}`}
      />

      <div className="surface">
        <div className="surface-filters">
           <div className="search-input-wrap">
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
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
              </div>
            </>
          )}
          pageSize={20}
        />
      </div>

      {isMobile ? (
        <BottomSheet
          isOpen={!!payModal}
          onClose={() => setPayModal(null)}
          title="Collect Payment"
        >
          <div className="form-stack">
            <div className="form-group">
              <label>Amount Collected (Rs)</label>
              <input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="e.g. Cash collected" />
            </div>
          </div>
          <button className="btn btn-primary btn-full-width" style={{ marginTop: 'var(--space-4)' }} onClick={handleRecordPayment} disabled={paying}>
            {paying ? "Recording..." : "Record Payment"}
          </button>
        </BottomSheet>
      ) : (
        <Modal
          open={!!payModal}
          onClose={() => setPayModal(null)}
          title={`Collect Payment from ${payModal?.name}`}
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
        </Modal>
      )}
    </div>
  );
}
