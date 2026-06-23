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

const fetchMessages = createApiFetch("/api/contact/admin/all");

const STATUS_OPTIONS = ["unread", "read", "replied"];

export default function ContactMessagesPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data, loading, error, refetch } = useApiData(fetchMessages);
  const messages = data?.messages ?? [];

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    let items = messages;
    if (statusFilter !== "all") items = items.filter((m) => m.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q) ||
          m.message?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [messages, statusFilter, search]);

  const openDetail = (msg) => {
    setSelected(msg);
    setNewStatus(msg.status);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await apiRequest(`/api/contact/admin/${selected._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message);
      toast.success("Status updated.");
      setSelected(null);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Sender",
      render: (r) => (
        <>
          <strong>{r.name}</strong>
          <span>{r.email}</span>
        </>
      ),
    },
    {
      key: "message",
      label: "Message",
      render: (r) => (
        <span className="cell-truncate">
          {r.message.length > 60 ? r.message.slice(0, 60) + "…" : r.message}
        </span>
      ),
    },
    { key: "status", label: "Status", render: (r) => <StatusTag value={r.status} /> },
    { key: "createdAt", label: "Date", render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  const renderMessageCard = (m) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          <span className="mc-name">{m.name}</span>
          <span className="mc-sub">{m.email}</span>
        </div>
        <StatusTag value={m.status} />
      </div>
      <div className="mc-stats">
        <div className="mc-stat">
          <span className="mc-stat-label">Preview</span>
          <span className="mc-stat-value muted">
            {m.message.length > 50 ? m.message.slice(0, 50) + "…" : m.message}
          </span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Date</span>
          <span className="mc-stat-value muted">{new Date(m.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </>
  );

  if (loading) return <LoadingScreen />;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="view-stack">
      <PageHeader
        title="Contact Messages"
        subtitle={`${messages.filter((m) => m.status === "unread").length} unread message(s)`}
      />

      <div className="surface">
        <div className="surface-filters">
          <div className="search-input-wrap">
            <input
              type="text"
              className="search-input"
              placeholder="Search name, email, or message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch("")} aria-label="Clear search">
                &times;
              </button>
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
          renderCard={renderMessageCard}
          onRowClick={openDetail}
          emptyText="No contact messages found."
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
      </FilterSheet>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Contact Message"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Update Status"}
            </button>
          </>
        }
      >
        {selected && (
          <div className="support-detail-stack">
            <div className="card-inset support-customer-card">
              <p className="eyebrow">Sender</p>
              <strong className="support-customer-name">{selected.name}</strong>
              <span className="support-customer-sub">{selected.email}</span>
            </div>

            <div>
              <p className="eyebrow">Message</p>
              <p className="support-section-text">{selected.message}</p>
            </div>

            <div className="form-group">
              <label>Update Status</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
