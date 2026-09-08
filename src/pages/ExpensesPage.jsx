import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, IndianRupee, TrendingUp, Hash, Filter, X } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import { expenseCategoryOptions, expensePaymentMethodOptions } from "../utils/constants";
import LoadingScreen from "../components/ui/LoadingScreen";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageError from "../components/ui/PageError";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import SearchInput from "../components/ui/SearchInput";
import toast from "react-hot-toast";

// ─── Constants ─────────────────────────────────────
const EMPTY_FORM = {
  amount: "",
  category: "miscellaneous",
  date: new Date().toISOString().slice(0, 10),
  description: "",
  paymentMethod: "cash",
  receiptReference: "",
};

const CATEGORY_LABELS = {
  fuel_transport: "Fuel & Transport",
  packaging: "Packaging",
  equipment: "Equipment",
  salaries: "Salaries",
  rent: "Rent",
  utilities: "Utilities",
  maintenance: "Maintenance",
  marketing: "Marketing",
  miscellaneous: "Miscellaneous",
};

const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

const fetchExpenses = createApiFetch("/api/expenses");
const fetchSummary = createApiFetch("/api/expenses/summary");

function formatCurrency(val) {
  return `₹${Number(val || 0).toLocaleString("en-IN")}`;
}

// Inline chip — avoids StatusTag's limitation of using the raw value as display text
function CategoryChip({ category }) {
  return (
    <span className={`exp-category-chip exp-cat-${category}`}>
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

// ─── Page Component ─────────────────────────────────
export default function ExpensesPage() {
  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Build filter params object — stable identity when values unchanged
  const filterParams = useMemo(() => {
    const p = {};
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    if (categoryFilter) p.category = categoryFilter;
    if (search) p.search = search;
    return p;
  }, [startDate, endDate, categoryFilter, search]);

  // Data fetching
  const { data, loading, error, refetch } = useApiData(
    () => fetchExpenses(filterParams),
    true
  );
  const { data: summary, refetch: refetchSummary } = useApiData(
    () => fetchSummary(filterParams),
    true
  );

  // Re-fetch when filters change (skip the initial mount — immediate=true handles that)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    refetch();
    refetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParams]);

  const expenses = data?.expenses ?? [];
  const totalAmount = data?.totalAmount ?? 0;
  const count = data?.count ?? 0;

  const topCategory = useMemo(() => {
    if (!summary?.byCategory?.length) return "—";
    return CATEGORY_LABELS[summary.byCategory[0]._id] || summary.byCategory[0]._id;
  }, [summary]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const refreshAll = useCallback(() => {
    refetch();
    refetchSummary();
  }, [refetch, refetchSummary]);

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (expense) => {
    setEditId(expense._id);
    setForm({
      amount: expense.amount,
      category: expense.category,
      date: new Date(expense.date).toISOString().slice(0, 10),
      description: expense.description,
      paymentMethod: expense.paymentMethod || "cash",
      receiptReference: expense.receiptReference || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (form.amount === "" || form.amount === undefined || form.amount === null) {
      return toast.error("Amount is required.");
    }
    if (Number(form.amount) < 0) {
      return toast.error("Amount must be a positive number.");
    }
    if (!form.category) return toast.error("Category is required.");
    if (!form.date) return toast.error("Date is required.");
    if (!form.description.trim()) return toast.error("Description is required.");

    setSaving(true);
    try {
      const url = editId ? `/api/expenses/${editId}` : "/api/expenses";
      const method = editId ? "PUT" : "POST";
      const res = await apiRequest(url, { method, body: JSON.stringify(form) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success(editId ? "Expense updated." : "Expense recorded.");
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      setEditId(null);
      refreshAll();
    } catch (err) {
      toast.error(err.message || "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    setDeleting(true);
    try {
      const res = await apiRequest(`/api/expenses/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success("Expense deleted.");
      setDeleteConfirm(null);
      refreshAll();
    } catch (err) {
      toast.error(err.message || "Failed to delete expense.");
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = startDate || endDate || categoryFilter;

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setCategoryFilter("");
  };

  // Desktop table columns
  const columns = [
    {
      key: "date",
      label: "Date",
      render: (r) => (
        <strong>
          {new Date(r.date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </strong>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (r) => <CategoryChip category={r.category} />,
    },
    {
      key: "amount",
      label: "Amount",
      render: (r) => <strong className="exp-amount">{formatCurrency(r.amount)}</strong>,
    },
    {
      key: "description",
      label: "Description",
      render: (r) => <span className="exp-desc-cell">{r.description}</span>,
    },
    {
      key: "paymentMethod",
      label: "Payment",
      render: (r) => (
        <span className="text-muted">{PAYMENT_METHOD_LABELS[r.paymentMethod] || r.paymentMethod}</span>
      ),
    },
    {
      key: "receiptReference",
      label: "Receipt",
      render: (r) => r.receiptReference ? (
        <span className="exp-receipt-ref">{r.receiptReference}</span>
      ) : (
        <span className="text-muted">—</span>
      ),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (r) => (
        <div className="exp-actions-cell">
          <button className="icon-button" onClick={() => openEdit(r)} title="Edit">
            <Pencil size={16} />
          </button>
          <button className="icon-button danger" onClick={() => setDeleteConfirm(r)} title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  // Mobile card renderer
  const renderCard = (e) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          <span className="mc-name">{e.description}</span>
          <span className="mc-sub">
            {new Date(e.date).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
            {e.receiptReference ? ` · ${e.receiptReference}` : ""}
          </span>
        </div>
        <div className="exp-card-right">
          <strong className="exp-amount">{formatCurrency(e.amount)}</strong>
          <span className="exp-payment-badge">
            {PAYMENT_METHOD_LABELS[e.paymentMethod] || e.paymentMethod}
          </span>
        </div>
      </div>
      <div className="exp-card-footer">
        <CategoryChip category={e.category} />
        <div className="exp-card-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(e)}>
            <Pencil size={14} /> Edit
          </button>
          <button className="icon-button danger" onClick={() => setDeleteConfirm(e)} title="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </>
  );

  if (loading) return <LoadingScreen />;
  if (error) return <PageError message={error} onRetry={refreshAll} />;

  return (
    <div className="view-stack expenses-page">
      {/* Header */}
      <PageHeader
        title="Expenses"
        subtitle="Track and manage business expenses"
        actions={
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={16} />
            Add Expense
          </button>
        }
      />

      {/* Summary cards */}
      <div className="exp-stats-row">
        <div className="exp-stat-card">
          <div className="exp-stat-icon">
            <IndianRupee size={18} />
          </div>
          <div>
            <span className="exp-stat-label">Total Spent</span>
            <span className="exp-stat-value">{formatCurrency(totalAmount)}</span>
          </div>
        </div>
        <div className="exp-stat-card">
          <div className="exp-stat-icon">
            <Hash size={18} />
          </div>
          <div>
            <span className="exp-stat-label">Entries</span>
            <span className="exp-stat-value">{count}</span>
          </div>
        </div>
        <div className="exp-stat-card">
          <div className="exp-stat-icon">
            <TrendingUp size={18} />
          </div>
          <div>
            <span className="exp-stat-label">Top Category</span>
            <span className="exp-stat-value exp-stat-value--category">{topCategory}</span>
          </div>
        </div>
      </div>

      {/* Filters + Table */}
      <div className="surface">
        <div className="surface-filters">
          {/* Search — always visible */}
          <div className="exp-search-row">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search descriptions…"
            />
            <button
              className={`btn btn-secondary btn-sm exp-filter-toggle ${showFilters || hasActiveFilters ? "active" : ""}`}
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter size={15} />
              Filters
              {hasActiveFilters && <span className="exp-filter-dot" />}
            </button>
          </div>

          {/* Collapsible filter panel */}
          {showFilters && (
            <div className="exp-filter-panel">
              <div className="exp-filter-grid">
                <div className="exp-filter-field">
                  <label className="exp-filter-label">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="exp-date-input"
                  />
                </div>
                <div className="exp-filter-field">
                  <label className="exp-filter-label">To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="exp-date-input"
                  />
                </div>
                <div className="exp-filter-field exp-filter-field--category">
                  <label className="exp-filter-label">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="exp-category-select"
                  >
                    <option value="">All Categories</option>
                    {expenseCategoryOptions.map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <button className="btn btn-ghost btn-sm exp-clear-btn" onClick={clearFilters}>
                  <X size={13} /> Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <DataTable
          columns={columns}
          data={expenses}
          renderCard={renderCard}
          emptyText="No expenses found. Tap 'Add Expense' to record one."
        />
      </div>

      {/* Add / Edit Modal */}
      <ResponsiveModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? "Edit Expense" : "Add Expense"}
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editId ? "Update" : "Add Expense"}
            </button>
          </>
        }
      >
        <div className="support-form-stack">
          <div className="exp-form-row">
            <div className="form-group">
              <label>Amount (₹) *</label>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Category *</label>
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            >
              {expenseCategoryOptions.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Description *</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="What was this expense for?"
            />
          </div>
          <div className="exp-form-row">
            <div className="form-group">
              <label>Payment Method</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))}
              >
                {expensePaymentMethodOptions.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Receipt Reference</label>
              <input
                value={form.receiptReference}
                onChange={(e) => setForm((p) => ({ ...p, receiptReference: e.target.value }))}
                placeholder="Invoice #, bill #…"
              />
            </div>
          </div>
        </div>
      </ResponsiveModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm?._id)}
        title="Delete Expense"
        message={`Delete "${deleteConfirm?.description}" (${formatCurrency(deleteConfirm?.amount)})?`}
        confirmText="Delete"
        loading={deleting}
      />
    </div>
  );
}
