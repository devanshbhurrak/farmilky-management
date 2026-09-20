import { useState } from "react";
import { Filter } from "lucide-react";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { apiRequest } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";
import LoadingScreen from "../components/ui/LoadingScreen";
import StatusTag from "../components/ui/StatusTag";
import PageError from "../components/ui/PageError";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import FilterSheet from "../components/ui/FilterSheet";
import SearchInput from "../components/ui/SearchInput";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

const STATUS_OPTIONS = ["requested", "approved", "rejected", "completed"];

export default function ReturnsPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ status: "", refundAmount: "", adminNotes: "" });
  const [saving, setSaving] = useState(false);

  const {
    data: returns,
    loading,
    error,
    pagination,
    search,
    sort,
    setPage,
    setLimit,
    setSearch,
    setSort,
    setFilterValue,
    refetch,
  } = usePaginatedFetch("/api/returns/admin/all", {
    initialLimit: 20,
    initialSort: { sortBy: "createdAt", sortOrder: "desc" },
    dataKey: "returns",
  });

  const handleStatusFilter = (val) => {
    setStatusFilter(val);
    setFilterValue("status", val === "all" ? "" : val);
  };
  const handleSort = (key, dir) => setSort(key, dir);
  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
    setFilterValue("status", "");
  };

  const openDetail = (r) => {
    setSelected(r);
    setForm({
      status: r.status,
      refundAmount: r.refundAmount != null ? String(r.refundAmount) : "",
      adminNotes: r.adminNotes || "",
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const payload = { status: form.status, adminNotes: form.adminNotes };
      if (form.refundAmount !== "") payload.refundAmount = Number(form.refundAmount);
      const res = await apiRequest(`/api/returns/admin/${selected._id}/status`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success("Return request updated.");
      setSelected(null);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "userId.name",
      label: "Customer",
      render: (r) => (
        <>
          <strong>{r.userId?.name || "Unknown"}</strong>
          <span>{r.userId?.phone || r.userId?.email || ""}</span>
        </>
      ),
    },
    {
      key: "orderId",
      label: "Order",
      render: (r) => <code>#{r.orderId?._id?.slice(-8).toUpperCase() || "-"}</code>,
    },
    { key: "reason", label: "Reason", render: (r) => <span className="cell-truncate">{r.reason}</span> },
    { key: "status", label: "Status", render: (r) => <StatusTag value={r.status} /> },
    {
      key: "refundAmount",
      label: "Refund",
      render: (r) => (r.refundAmount != null ? formatCurrency(r.refundAmount) : "-"),
    },
    { key: "createdAt", label: "Date", render: (r) => formatDate(r.createdAt) },
  ];

  const renderReturnCard = (r) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          <span className="mc-name">{r.userId?.name || "Unknown"}</span>
          <span className="mc-sub">Order #{r.orderId?._id?.slice(-8).toUpperCase()}</span>
        </div>
        <StatusTag value={r.status} />
      </div>
      <div className="mc-stats">
        <div className="mc-stat">
          <span className="mc-stat-label">Date</span>
          <span className="mc-stat-value muted">{formatDate(r.createdAt)}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Refund</span>
          <span className="mc-stat-value">{r.refundAmount != null ? formatCurrency(r.refundAmount) : "—"}</span>
        </div>
      </div>
      <div className="mc-footer">
        <span className="mc-footer-label">Reason</span>
        {r.reason}
      </div>
    </>
  );

  const hasFilters = statusFilter !== "all" || !!search.trim();

  if (loading && returns.length === 0) return <LoadingScreen />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="view-stack returns-page">
      <PageHeader
        title="Return Requests"
        subtitle={`${pagination.total} request${pagination.total !== 1 ? "s" : ""} total`}
      />

      <div className="surface">
        <div className="surface-filters">
          <SearchInput value={search} onChange={setSearch} placeholder="Search reason or customer..." />
          {!isMobile ? (
            <div className="desktop-filters support-filter-row">
              <select value={statusFilter} onChange={(e) => handleStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          ) : (
            <button className="filter-toggle-btn support-filter-end" onClick={() => setIsFilterSheetOpen(true)}>
              <Filter size={16} />
              <span>Filters{hasFilters ? " •" : ""}</span>
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={returns}
          loading={loading}
          renderCard={renderReturnCard}
          onRowClick={openDetail}
          emptyText="No return requests found."
          noMatchAction={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
          pagination={{ ...pagination, onPageChange: setPage, onLimitChange: setLimit }}
          sortBy={sort.sortBy}
          sortOrder={sort.sortOrder}
          onSortChange={handleSort}
          serverSide
        />
      </div>

      <FilterSheet isOpen={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)}>
        <div className="form-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => handleStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </FilterSheet>

      <ResponsiveModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Review Return Request"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Update Request"}
            </button>
          </>
        }
      >
        {selected && (
          <div className="support-detail-stack">
            <div className="card-inset support-customer-card">
              <p className="eyebrow">Customer</p>
              <strong className="support-customer-name">{selected.userId?.name}</strong>
              <span className="support-customer-sub">{selected.userId?.email}</span>
            </div>

            <div className="returns-order-grid">
              <div>
                <p className="eyebrow">Order ID</p>
                <code>#{selected.orderId?._id?.slice(-8).toUpperCase()}</code>
              </div>
              <div>
                <p className="eyebrow">Order Value</p>
                <strong>{formatCurrency(selected.orderId?.totalAmount || 0)}</strong>
              </div>
            </div>

            <div>
              <p className="eyebrow">Reason for Return</p>
              <p className="support-section-text">{selected.reason}</p>
            </div>

            <div className="form-group">
              <label>Update Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Refund Amount ({formatCurrency(0).split(" ")[0]})</label>
              <input
                type="number"
                inputMode="decimal"
                value={form.refundAmount}
                onChange={(e) => setForm((p) => ({ ...p, refundAmount: e.target.value }))}
                placeholder="Leave blank if no refund"
              />
            </div>

            <div className="form-group">
              <label>Internal Admin Notes</label>
              <textarea
                rows={3}
                value={form.adminNotes}
                onChange={(e) => setForm((p) => ({ ...p, adminNotes: e.target.value }))}
                placeholder="Notes for internal tracking..."
              />
            </div>
          </div>
        )}
      </ResponsiveModal>
    </div>
  );
}
