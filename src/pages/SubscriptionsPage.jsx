import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Pause, Play } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import ActionRow from "../components/ui/ActionRow";
import DataTable from "../components/ui/DataTable";
import FilterSheet from "../components/ui/FilterSheet";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import { subscriptionStatusOptions } from "../utils/constants";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { apiRequest } from "../api/client";
import toast from "react-hot-toast";

export default function SubscriptionsPage({ subscriptions, onUpdate }) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(null);

  const filtered = useMemo(() => {
    let items = subscriptions || [];
    if (statusFilter !== "all") items = items.filter((s) => s.status === statusFilter);
    if (scheduleFilter !== "all") items = items.filter((s) => s.deliverySchedule === scheduleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (s) =>
          (s.userId?.name || "").toLowerCase().includes(q) ||
          (s.userId?.email || "").toLowerCase().includes(q) ||
          (s.userId?.phone || "").toLowerCase().includes(q) ||
          (s.productId?.name || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [subscriptions, statusFilter, scheduleFilter, search]);

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s._id)));
  };

  const bulkAction = async (action) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const url = action === "pause"
        ? "/api/admin/subscriptions/bulk-pause"
        : "/api/admin/subscriptions/bulk-resume";
      const res = await apiRequest(url, {
        method: "PUT",
        body: JSON.stringify({ subscriptionIds: Array.from(selected) }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message);
      toast.success(payload.message || `Bulk ${action} done.`);
      setSelected(new Set());
      setBulkConfirm(null);
    } catch (err) {
      toast.error(err.message || `Bulk ${action} failed.`);
    } finally {
      setBulkLoading(false);
    }
  };

  const columns = [
    {
      key: "_select",
      label: (
        <input
          type="checkbox"
          checked={filtered.length > 0 && selected.size === filtered.length}
          onChange={toggleSelectAll}
        />
      ),
      sortable: false,
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected.has(r._id)}
            onChange={() => toggleSelect(r._id)}
          />
        </div>
      ),
    },
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
      key: "productId.name",
      label: "Product",
      render: (r) => (
        <>
          <strong>{r.productId?.name || "Unknown"}</strong>
          <span>{r.quantityPerDay} {r.productId?.unit} / {r.deliverySchedule}</span>
        </>
      ),
    },
    { key: "startDate", label: "Started", render: (r) => formatDate(r.startDate) },
    {
      key: "pendingAmount",
      label: "Pending",
      render: (r) => <strong style={{ color: r.pendingAmount > 0 ? "var(--danger)" : "inherit" }}>{formatCurrency(r.pendingAmount)}</strong>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusTag value={r.status} />,
    },
  ];

  const renderSubscriptionCard = (sub) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          <span className="mc-name">{sub.userId?.name || "Unknown"}</span>
          <span className="mc-sub">{sub.productId?.name || "Unknown"} · {sub.quantityPerDay} {sub.productId?.unit} / {sub.deliverySchedule}</span>
        </div>
        <StatusTag value={sub.status} />
      </div>
      <div className="mc-stats">
        <div className="mc-stat">
          <span className="mc-stat-label">Started</span>
          <span className="mc-stat-value muted">{formatDate(sub.startDate)}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Schedule</span>
          <span className="mc-stat-value">{sub.deliverySchedule}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Pending</span>
          <span className={`mc-stat-value ${sub.pendingAmount > 0 ? "danger" : "muted"}`}>
            {formatCurrency(sub.pendingAmount)}
          </span>
        </div>
      </div>
    </>
  );

  const filters = (
    <>
      <div className="form-group">
        <label>Status</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="form-group">
        <label>Schedule</label>
        <select value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
          <option value="all">All Schedules</option>
          <option value="daily">Daily</option>
          <option value="alternate">Alternate</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom</option>
        </select>
      </div>
    </>
  );

  const hasFilters = statusFilter !== "all" || scheduleFilter !== "all" || !!search.trim();
  const clearFilters = () => {
    setStatusFilter("all");
    setScheduleFilter("all");
    setSearch("");
  };

  return (
    <div>
      <PageHeader 
        title="Subscriptions" 
        subtitle={`Total active subscriptions: ${subscriptions?.filter(s => s.status === "active").length || 0}`}
      />

      <div className="surface">
        <div className="surface-filters">
          <input
            type="text"
            placeholder="Search customer or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          {!isMobile && (
            <div className="desktop-filters">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
                <option value="all">All Schedules</option>
                <option value="daily">Daily</option>
                <option value="alternate">Alternate</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          )}
          {isMobile && (
            <button
              className="filter-toggle-btn"
              onClick={() => setIsFilterSheetOpen(true)}
            >
              <Filter size={16} />
              <span>Filters</span>
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="bulk-toolbar">
            <span className="bulk-count">{selected.size} selected</span>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setBulkConfirm("pause")}
              disabled={bulkLoading}
            >
              <Pause size={14} /> Bulk Pause
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setBulkConfirm("resume")}
              disabled={bulkLoading}
            >
              <Play size={14} /> Bulk Resume
            </button>
            <button className="btn-ghost" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={filtered}
          renderCard={renderSubscriptionCard}
          onRowClick={(row) => navigate(`/subscriptions/${row._id}`)}
          emptyText="No subscriptions available."
          noMatchAction={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
          defaultSortKey="startDate"
          defaultSortDir="desc"
        />
      </div>

      <FilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
      >
        {filters}
      </FilterSheet>

      <ConfirmDialog
        open={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        onConfirm={() => bulkAction(bulkConfirm)}
        title={bulkConfirm === "pause" ? "Pause Subscriptions" : "Resume Subscriptions"}
        message={`${bulkConfirm === "pause" ? "Pause" : "Resume"} ${selected.size} selected subscription${selected.size === 1 ? "" : "s"}?`}
        confirmText={bulkConfirm === "pause" ? "Pause" : "Resume"}
        loading={bulkLoading}
        variant={bulkConfirm === "pause" ? "danger" : "primary"}
      />
    </div>
  );
}
