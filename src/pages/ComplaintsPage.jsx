import { useState, useMemo } from "react";
import { Filter } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import LoadingScreen from "../components/ui/LoadingScreen";
import StatusTag from "../components/ui/StatusTag";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import Modal from "../components/ui/Modal";
import FilterSheet from "../components/ui/FilterSheet";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

const fetchComplaints = createApiFetch("/api/complaints/admin/all");

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];
const RELATED_OPTIONS = ["order", "subscription", "delivery", "product", "other"];

export default function ComplaintsPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data, loading, error, refetch } = useApiData(fetchComplaints);
  const complaints = data?.complaints ?? [];

  const [statusFilter, setStatusFilter] = useState("all");
  const [relatedFilter, setRelatedFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [selected, setSelected] = useState(null);
  const [resolution, setResolution] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    let items = complaints;
    if (statusFilter !== "all") items = items.filter((c) => c.status === statusFilter);
    if (relatedFilter !== "all") items = items.filter((c) => c.relatedTo === relatedFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.subject?.toLowerCase().includes(q) ||
          c.userId?.name?.toLowerCase().includes(q) ||
          c.userId?.email?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [complaints, statusFilter, relatedFilter, search]);

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
          <span className="mc-stat-label">Related To</span>
          <StatusTag value={c.relatedTo} />
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Date</span>
          <span className="mc-stat-value muted">{new Date(c.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </>
  );

  if (loading) return <LoadingScreen />;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="view-stack complaints-page">
      <PageHeader
        title="Complaints"
        subtitle={`${complaints.filter((c) => c.status === "open").length} open issues require attention`}
      />

      <div className="surface">
        <div className="surface-filters">
          <div className="search-input-wrap">
            <input
              type="text"
              className="search-input"
              placeholder="Search subject or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch("")} aria-label="Clear search">&times;</button>
            )}
          </div>
          {!isMobile && (
            <div className="desktop-filters">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select value={relatedFilter} onChange={(e) => setRelatedFilter(e.target.value)}>
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
              <span>Filters</span>
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          renderCard={renderComplaintCard}
          onRowClick={openDetail}
          emptyText="No complaints found."
          defaultSortKey="createdAt"
          defaultSortDir="desc"
        />
      </div>

      <FilterSheet isOpen={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)}>
        <div className="form-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={relatedFilter} onChange={(e) => setRelatedFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {RELATED_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </FilterSheet>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Complaint Details"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Update Complaint"}
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
      </Modal>
    </div>
  );
}
