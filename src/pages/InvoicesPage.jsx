import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Filter } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import EmptyState from "../components/ui/EmptyState";
import PageSkeleton from "../components/ui/PageSkeleton";
import DataTable from "../components/ui/DataTable";
import Modal from "../components/ui/Modal";
import FilterSheet from "../components/ui/FilterSheet";
import PageHeader from "../components/ui/PageHeader";
import toast from "react-hot-toast";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest, safeParseJson } from "../api/client";
import { useMediaQuery } from "../hooks/useMediaQuery";

const fetchInvoices = createApiFetch("/api/invoices/admin/all");

export default function InvoicesPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data, loading, error, refetch } = useApiData(fetchInvoices);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amountPaid: "", transactionId: "" });
  const [paying, setPaying] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const invoices = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.invoices && Array.isArray(data.invoices)) return data.invoices;
    return [];
  }, [data]);

  const filtered = useMemo(() => {
    let items = invoices;
    if (statusFilter !== "all") items = items.filter((inv) => inv.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (inv) =>
          (inv.userId?.name || "").toLowerCase().includes(q) ||
          (inv.userId?.email || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [invoices, statusFilter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [filtered]);

  function isOverdue(invoice) {
    if (invoice.status === "paid") return false;
    if (!invoice.dueDate) return false;
    return new Date(invoice.dueDate) < new Date();
  }

  function openPayModal(invoice) {
    setPayModal(invoice);
    const remaining = (invoice.totalAmount || 0) - (invoice.amountPaid || 0);
    setPayForm({ amountPaid: remaining > 0 ? remaining : "", transactionId: "" });
  }

  const remainingAmount = Math.max(0, (payModal?.totalAmount || 0) - (payModal?.amountPaid || 0));
  const paymentAmount = Number(payForm.amountPaid);
  const isPaymentAmountValid = Number.isFinite(paymentAmount) && paymentAmount > 0 && paymentAmount <= remainingAmount;

  async function handlePay(e) {
    e.preventDefault();
    if (!payModal) return;
    setPaying(true);
    try {
      const body = {
        amountPaid: Number(payForm.amountPaid),
        transactionId: payForm.transactionId || undefined,
      };
      const res = await apiRequest(`/api/invoices/admin/${payModal._id}/status`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Payment failed"); }
      toast.success("Payment recorded.");
      setPayModal(null);
      await refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
    }
  }

  // Derived financial totals (computed once, reused in both mobile strip and desktop grid)
  const totalBilled      = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const totalCollected   = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + (i.totalAmount - (i.amountPaid || 0)), 0);

  const columns = [
    {
      key: "_id",
      label: "Invoice",
      sortable: false,
      render: (r) => <code>#{r._id?.slice(-8)}</code>,
    },
    {
      key: "userId.name",
      label: "Customer",
      render: (r) => (
        <>
          {r.userId?._id ? (
            <Link to={`/customers/${r.userId._id}`} onClick={(e) => e.stopPropagation()}>
              <strong>{r.userId?.name || "Unknown"}</strong>
            </Link>
          ) : (
            <strong>{r.userId?.name || "Unknown"}</strong>
          )}
          <span>{r.userId?.phone || ""}</span>
        </>
      ),
    },
    {
      key: "subscriptionId.productId.name",
      label: "Product",
      render: (r) => r.subscriptionId?.productId?.name || r.subscriptionId?.productId || "—",
    },
    { key: "month", label: "Month" },
    {
      key: "totalAmount",
      label: "Total",
      render: (r) => <strong>{formatCurrency(r.totalAmount)}</strong>,
    },
    {
      key: "amountPaid",
      label: "Paid",
      render: (r) => formatCurrency(r.amountPaid || 0),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <>
          <StatusTag value={isOverdue(r) ? "unpaid" : r.status} />
          {isOverdue(r) && <span className="inv-overdue-label">Overdue</span>}
        </>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      render: (r) => (r.dueDate ? formatDate(r.dueDate) : "—"),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (r) =>
        r.status !== "paid" ? (
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => { e.stopPropagation(); openPayModal(r); }}
          >
            Record Payment
          </button>
        ) : null,
    },
  ];

  const renderInvoiceCard = (invoice) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          {invoice.userId?._id ? (
            <Link
              to={`/customers/${invoice.userId._id}`}
              onClick={(e) => e.stopPropagation()}
              className="mc-name inv-customer-link"
            >
              {invoice.userId?.name || "Unknown"}
            </Link>
          ) : (
            <span className="mc-name">{invoice.userId?.name || "Unknown"}</span>
          )}
          <span className="mc-sub">{invoice.month}</span>
        </div>
        <StatusTag value={isOverdue(invoice) ? "unpaid" : invoice.status} />
      </div>
      <div className="mc-stats">
        <div className="mc-stat">
          <span className="mc-stat-label">Total</span>
          <span className="mc-stat-value">{formatCurrency(invoice.totalAmount)}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Paid</span>
          <span className="mc-stat-value success">{formatCurrency(invoice.amountPaid || 0)}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Due</span>
          <span className={`mc-stat-value ${(invoice.totalAmount - (invoice.amountPaid || 0)) > 0 ? "danger" : "muted"}`}>
            {formatCurrency(invoice.totalAmount - (invoice.amountPaid || 0))}
          </span>
        </div>
      </div>
      {invoice.status !== "paid" && (
        <div className="inv-card-action">
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => { e.stopPropagation(); openPayModal(invoice); }}
          >
            Record Payment
          </button>
        </div>
      )}
    </>
  );

  const hasFilters = statusFilter !== "all" || !!search.trim();
  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  if (loading) return <PageSkeleton />;
  if (error) return <EmptyState text={error} action={{ label: "Retry", onClick: refetch }} />;

  return (
    <div className="view-stack invoices-page">
      <PageHeader
        title="Invoices"
        subtitle={`Outstanding balance: ${formatCurrency(totalOutstanding)}`}
      />

      {/* Desktop summary — 3-col stat cards */}
      {!isMobile && (
        <div className="inv-summary-grid">
          <div className="card-inset">
            <div className="inv-summary-stat">
              <span className="inv-summary-label">Total Billed</span>
              <strong className="inv-summary-value">{formatCurrency(totalBilled)}</strong>
            </div>
          </div>
          <div className="card-inset">
            <div className="inv-summary-stat">
              <span className="inv-summary-label">Collected</span>
              <strong className="inv-summary-value collected">{formatCurrency(totalCollected)}</strong>
            </div>
          </div>
          <div className="card-inset">
            <div className="inv-summary-stat">
              <span className="inv-summary-label">Outstanding</span>
              <strong className="inv-summary-value outstanding">{formatCurrency(totalOutstanding)}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="surface">
        <div className="surface-filters">
          <input
            type="text"
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          {!isMobile && (
            <div className="desktop-filters">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          )}
          {isMobile && (
            <button className="filter-toggle-btn" onClick={() => setIsFilterSheetOpen(true)}>
              <Filter size={16} />
              <span>Filters</span>
            </button>
          )}
        </div>

        {/* Mobile financial summary strip */}
        {isMobile && (
          <div className="inv-mobile-strip">
            <div className="inv-strip-stat">
              <span>Billed</span>
              <strong>{formatCurrency(totalBilled)}</strong>
            </div>
            <div className="inv-strip-stat">
              <span>Collected</span>
              <strong className="success">{formatCurrency(totalCollected)}</strong>
            </div>
            <div className="inv-strip-stat">
              <span>Outstanding</span>
              <strong className="danger">{formatCurrency(totalOutstanding)}</strong>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={sorted}
          renderCard={renderInvoiceCard}
          emptyText="No invoices found."
          noMatchAction={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
          defaultSortKey="createdAt"
          defaultSortDir="desc"
          pageSize={20}
          onRowClick={undefined}
        />
      </div>

      <FilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
      >
        <div className="form-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </FilterSheet>

      <Modal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title="Record Payment"
        footer={
          <button
            className="btn btn-primary btn-sm"
            form="pay-form"
            disabled={paying || !isPaymentAmountValid}
          >
            {paying ? "Processing..." : "Record Payment"}
          </button>
        }
      >
        <form id="pay-form" onSubmit={handlePay}>
          <div className="inv-pay-summary">
            <p>Invoice: <code>#{payModal?._id?.slice(-8)}</code></p>
            <p>Total: <strong>{formatCurrency(payModal?.totalAmount || 0)}</strong></p>
            <p>Already Paid: <strong>{formatCurrency(payModal?.amountPaid || 0)}</strong></p>
            <p>Remaining: <strong className={remainingAmount > 0 ? "inv-pay-remaining" : ""}>{formatCurrency(remainingAmount)}</strong></p>
          </div>
          <div className="form-group">
            <label>Amount Paid Now</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingAmount.toFixed(2)}
              value={payForm.amountPaid}
              onChange={(e) => setPayForm((f) => ({ ...f, amountPaid: e.target.value }))}
              required
            />
            {payForm.amountPaid && !isPaymentAmountValid && (
              <small className="form-help error">Enter an amount between 0.01 and {formatCurrency(remainingAmount)}.</small>
            )}
          </div>
          <div className="form-group">
            <label>Transaction ID <span style={{ fontWeight: "normal", color: "var(--text-muted)" }}>(optional)</span></label>
            <input
              value={payForm.transactionId}
              onChange={(e) => setPayForm((f) => ({ ...f, transactionId: e.target.value }))}
              placeholder="e.g. UPI ref, bank transfer ID"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
