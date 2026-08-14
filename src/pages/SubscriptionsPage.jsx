import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Pause, Play, Plus } from "lucide-react";
import { formatCurrency, formatDate, todayLocal } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import DataTable from "../components/ui/DataTable";
import FilterSheet from "../components/ui/FilterSheet";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import SubscriptionForm from "../components/subscription/SubscriptionForm";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { apiRequest, safeParseJson } from "../api/client";
import toast from "react-hot-toast";

export default function SubscriptionsPage({ subscriptions, onRefresh }) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [pauseFrom, setPauseFrom] = useState(todayLocal());
  const [pauseUntil, setPauseUntil] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ userId: "", productId: "", variantId: null, quantityPerDay: 1, pricePerUnit: null, deliverySchedule: "daily", customDays: [], startDate: todayLocal() });

  useEffect(() => {
    if (modalOpen) {
      Promise.all([
        apiRequest("/api/products").then(r => r.json()),
        apiRequest("/api/user/admin/all").then(r => r.json())
      ]).then(([pData, cData]) => {
        setProducts(pData.products || pData || []);
        setCustomers(cData.users || cData || []);
      }).catch(() => {
        toast.error("Failed to load dependency data");
      });
    }
  }, [modalOpen]);

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
    if (filtered.every((s) => selected.has(s._id))) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s._id)));
  };

  const bulkAction = async (action) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      if (action === "pause" && (!pauseFrom || !pauseUntil)) {
        throw new Error("Pause requires both a start and end date.");
      }
      if (action === "pause" && new Date(pauseUntil) <= new Date(pauseFrom)) {
        throw new Error("Pause end date must be after the start date.");
      }
      const url = action === "pause"
        ? "/api/admin/subscriptions/bulk-pause"
        : "/api/admin/subscriptions/bulk-resume";
      const res = await apiRequest(url, {
        method: "PUT",
        body: JSON.stringify({
          subscriptionIds: Array.from(selected),
          ...(action === "pause" ? { pauseFrom, pauseUntil } : {}),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message);
      toast.success(payload.message || `Bulk ${action} done.`);
      setSelected(new Set());
      setBulkConfirm(null);
      if (onRefresh) onRefresh();
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
          checked={filtered.length > 0 && filtered.every((s) => selected.has(s._id))}
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
          <span className="cell-sub">{r.userId?.phone || r.userId?.email || ""}</span>
        </>
      ),
    },
    {
      key: "productId.name",
      label: "Product",
      render: (r) => (
        <>
          <strong>{r.productId?.name || "Unknown"}</strong>
          <span className="cell-sub">{r.quantityPerDay} {r.productId?.unit} / {r.deliverySchedule}</span>
        </>
      ),
    },
    { key: "startDate", label: "Started", render: (r) => formatDate(r.startDate) },
    {
      key: "totalPricePerDay",
      label: "Daily Value",
      render: (r) => {
        const isCustom = r.pricePerUnit != null && r.productId && r.pricePerUnit !== r.productId.price;
        return (
          <div className="stack-cell">
            <strong>{formatCurrency(r.totalPricePerDay)}</strong>
            {isCustom && (
              <span className="price-badge">
                CUSTOM ₹{r.pricePerUnit}/{r.productId?.unit}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "pendingAmount",
      label: "Pending",
      render: (r) => (
        <strong className={r.pendingAmount > 0 ? "danger-text" : undefined}>
          {formatCurrency(r.pendingAmount)}
        </strong>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusTag value={r.status} />,
    },
  ];

  const scheduleLabel = { daily: "Daily", alternate: "Alt. days", weekly: "Weekly", custom: "Custom" };

  const renderSubscriptionCard = (sub) => {
    const isCustomPrice = sub.pricePerUnit != null && sub.productId && sub.pricePerUnit !== sub.productId.price;
    return (
      <>
        <div className={`mc-head mc-head--${sub.status}`}>
          <div className="mc-identity">
            <span className="mc-name">{sub.userId?.name || "Unknown"}</span>
            <span className="mc-sub">
              {sub.productId?.name || "Unknown"} &middot; {sub.quantityPerDay}&nbsp;{sub.productId?.unit}
            </span>
          </div>
          <div className="mc-tags">
            <StatusTag value={sub.status} />
            <span className={`mc-schedule-tag schedule-${sub.deliverySchedule}`}>
              {scheduleLabel[sub.deliverySchedule] || sub.deliverySchedule}
            </span>
          </div>
        </div>
        <div className="mc-stats">
          <div className="mc-stat">
            <span className="mc-stat-label">Daily Value</span>
            <span className="mc-stat-value">
              {formatCurrency(sub.totalPricePerDay)}
              {isCustomPrice && <span className="mc-custom-badge">Custom</span>}
            </span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">Since</span>
            <span className="mc-stat-value">{formatDate(sub.startDate) || "—"}</span>
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
  };

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

  function openCreate() {
    setForm({ userId: "", productId: "", variantId: null, quantityPerDay: 1, pricePerUnit: null, deliverySchedule: "daily", customDays: [], startDate: todayLocal() });
    setModalOpen(true);
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest("/api/subscriptions/admin/create", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const payload = await safeParseJson(res);
      if (!res.ok) throw new Error(payload?.message || "Failed to create subscription");
      
      toast.success("Subscription created successfully!");
      setModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const formContent = (
    <SubscriptionForm
      form={form}
      onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
      products={products}
      customers={customers}
      onSubmit={handleSave}
      saving={saving}
    />
  );

  return (
    <div className="view-stack subscriptions-page">
      <PageHeader
        title="Subscriptions"
        subtitle={`Total active subscriptions: ${subscriptions?.filter(s => s.status === "active").length || 0}`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} /> Add Subscription
          </button>
        }
      />

      <div className="surface">
        <div className="surface-filters">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search customer or product..."
            aria-label="Search subscriptions"
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
              className={`filter-toggle-btn${hasFilters ? " filter-toggle-btn--active" : ""}`}
              onClick={() => setIsFilterSheetOpen(true)}
            >
              <Filter size={16} />
              <span>Filters{hasFilters ? " •" : ""}</span>
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
      >
        {bulkConfirm === "pause" && (
          <div className="bulk-pause-dates">
            <div className="form-group">
              <label>Pause From</label>
              <input type="date" value={pauseFrom} onChange={(e) => setPauseFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Pause Until</label>
              <input type="date" value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} />
            </div>
          </div>
        )}
      </ConfirmDialog>

      <ResponsiveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Subscription"
        footer={
          <div className="product-modal-footer-right">
            <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Creating…" : "Create Subscription"}
            </button>
          </div>
        }
      >
        {formContent}
      </ResponsiveModal>
    </div>
  );
}
