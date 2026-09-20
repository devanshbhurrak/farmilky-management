import { useState } from "react";
import { Filter } from "lucide-react";
import { formatDate } from "../utils/format";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { apiRequest } from "../api/client";
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

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];
const RELATED_OPTIONS = ["order", "subscription", "delivery", "product", "other"];

export default function ComplaintsPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [statusFilter, setStatusFilter] = useState("all");
  const [relatedFilter, setRelatedFilter] = useState("all");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [selected, setSelected] = useState(null);
  const [resolution, setResolution] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    data: complaints,
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
  } = usePaginatedFetch("/api/complaints/admin/all", {
    initialLimit: 20,
    initialSort: { sortBy: "createdAt", sortOrder: "desc" },
    dataKey: "complaints",
  });

  const handleStatusFilter = (val) => {
    setStatusFilter(val);
    setFilterValue("status", val === "all" ? "" : val);
  };
  const handleRelatedFilter = (val) => {
    setRelatedFilter(val);
    setFilterValue("relatedTo", val === "all" ? "" : val);
  };
  const handleSort = (key, dir) => setSort(key, dir);
  const clearFilters = () => {
    setStatusFilter("all");
    setRelatedFilter("all");
    setSearch("");
    setFilterValue("status", "");
    setFilterValue("relatedTo", "");
  };

  const openDetail = (complaint) => {
    setSelected(complaint);
    setNewStatus(complaint.status);
    setResolution(complaint.resolution || "");
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await apiRequest(`/api/complaints/admin/${selected._id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus, resolution }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message);
      toast.success("Complaint updated.");
      setSelected(null);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to update complaint.");
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
    { key: "subject", label: "Subject", render: (r) => <span className="cell-truncate">{r.subject}</span> },
    { key: "relatedTo", label: "Category", render: (r) => <StatusTag value={r.relatedTo} /> },
    { key: "status", label: "Status", render: (r) => <StatusTag value={r.status} /> },
    { key: "createdAt", label: "Date", render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  const renderComplaintCard = (c) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          <span className="mc-name">{c.userId?.name || "Unknown"}</span>
          <span className="mc-sub">{c.subject}</span>
        </div>
        <StatusTag value={c.status} />
      </div>
      <div className="mc-stats">
        <div className="mc-stat">
          <span className="mc-stat-label">Category</span>
          <span className="mc-chip">{c.relatedTo}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Date</span>
          <span className="mc-stat-value muted">{formatDate(c.createdAt)}</span>
        </div>
      </div>
    </>
  );

  const hasFilters = statusFilter !== "all" || relatedFilter !== "all" || !!search.trim();

  if (loading && complaints.length === 0) return <LoadingScreen />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="view-stack complaints-page">
      <PageHeader
        title="Complaints"
        subtitle={`${pagination.total} complaint${pagination.total !== 1 ? "s" : ""} total`}
      />

      <div className="surface">
        <div className="surface-filters">
          <SearchInput value={search} onChange={setSearch} placeholder="Search subject or customer..." />
          {!isMobile && (
            <div className="desktop-filters">
              <select value={statusFilter} onChange={(e) => handleStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select value={relatedFilter} onChange={(e) => handleRelatedFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {RELATED_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
          {isMobile && (
            <button className="filter-toggle-btn" onClick={() => setIsFilterSheetOpen(true)}>
              <Filter size={16} />
              <span>Filters{hasFilters ? " •" : ""}</span>
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={complaints}
          loading={loading}
          renderCard={renderComplaintCard}
          onRowClick={openDetail}
          emptyText="No complaints found."
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
        <div className="form-group">
          <label>Category</label>
          <select value={relatedFilter} onChange={(e) => handleRelatedFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {RELATED_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </FilterSheet>

      <ResponsiveModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Complaint Details"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Update Complaint"}
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

            <div>
              <p className="eyebrow">Subject</p>
              <p className="support-section-title">{selected.subject}</p>
            </div>

            <div>
              <p className="eyebrow">Description</p>
              <p className="support-section-text">{selected.description}</p>
            </div>

            <div className="form-group">
              <label>Update Status</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Resolution / Response</label>
              <textarea
                rows={4}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Provide a resolution or response..."
              />
            </div>
          </div>
        )}
      </ResponsiveModal>
    </div>
  );
}
