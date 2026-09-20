import { Filter, CheckSquare, MapPin, ListOrdered } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import IconDropdown from "../components/ui/IconDropdown";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { formatDate, todayLocal } from "../utils/format";
import EmptyState from "../components/ui/EmptyState";
import LoadingScreen from "../components/ui/LoadingScreen";
import PageError from "../components/ui/PageError";
import FilterSheet from "../components/ui/FilterSheet";
import OutcomeModal from "../components/delivery/OutcomeModal";
import BulkActionsBar from "../components/delivery/BulkActionsBar";
import CustomerDeliveryGroup from "../components/delivery/CustomerDeliveryGroup";
import CustomerConfirmDrawer from "../components/delivery/CustomerConfirmDrawer";
import DeliveryFilters from "../components/delivery/DeliveryFilters";
import { apiRequest, safeParseJson } from "../api/client";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function DeliveriesPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { isAdmin } = useAuth();
  const [date, setDate] = useState(todayLocal);
  const [searchValue, setSearchValue] = useState("");
  const [typeTab, setTypeTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [sortMode, setSortMode] = useState("sequence");
  const [outcomeModal, setOutcomeModal] = useState(null);
  const [customerDrawer, setCustomerDrawer] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [areas, setAreas] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const outcomeInFlight = useRef(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const drawerInFlight = useRef(false);
  const PAGE_SIZE = 50;

  const [boardData, setBoardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchBoard = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date, page: String(page), limit: String(PAGE_SIZE) });
      if (typeTab !== "all") params.set("type", typeTab);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (areaFilter !== "all") params.set("area", areaFilter);
      if (searchValue.trim()) params.set("search", searchValue.trim());
      if (sortMode) params.set("sort", sortMode);
      const res = await apiRequest(`/api/subscriptions/admin/delivery-board?${params}`, { signal: controller.signal });
      if (!res.ok) {
        const payload = await safeParseJson(res);
        throw new Error(payload?.message || "Failed to load delivery board");
      }
      const payload = await res.json();
      setBoardData(payload);
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Failed to load delivery board");
    } finally {
      setLoading(false);
    }
  }, [date, page, typeTab, statusFilter, areaFilter, searchValue, sortMode]);

  useEffect(() => { fetchBoard(); return () => { if (abortRef.current) abortRef.current.abort(); }; }, [fetchBoard]);

  useEffect(() => { setPage(1); }, [searchValue, typeTab, statusFilter, date, areaFilter, sortMode]);

  useEffect(() => {
    apiRequest("/api/areas?limit=100")
      .then((r) => r.json())
      .then((d) => setAreas(d.areas || []))
      .catch(() => {});
  }, []);

  const summary = useMemo(() => boardData?.summary || {}, [boardData]);
  const deliveries = useMemo(() => boardData?.deliveries || [], [boardData]);
  const total = boardData?.total ?? deliveries.length;
  const totalPages = boardData?.totalPages ?? Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Group deliveries by customer (backend already paginated, so grouping is on paged data)
  const customerGroups = useMemo(() => {
    const map = new Map();
    for (const item of deliveries) {
      const key = item.userId || item.customerName;
      if (!map.has(key)) {
        map.set(key, {
          userId: item.userId,
          customerName: item.customerName,
          phone: item.phone,
          email: item.email,
          areaId: item.areaId,
          areaName: item.areaName,
          address: item.address,
          lat: item.lat,
          lng: item.lng,
          items: [],
        });
      }
      map.get(key).items.push(item);
    }
    return Array.from(map.values());
  }, [deliveries]);

  function openOutcomeModal(item, mode) {
    const prefilledQty = item.scheduledQuantity ?? item.quantity ?? 0;
    setOutcomeModal({
      item,
      mode,
      form: {
        actualQuantity: prefilledQty,
      },
    });
  }

  function openCustomerDrawer(group) {
    setCustomerDrawer({ group });
  }

  async function handleCustomerDrawerConfirm({ extraItems, paymentMode, subscriptionId }) {
    if (extraItems.length === 0) { setCustomerDrawer(null); return; }
    if (drawerInFlight.current) return;
    const { group } = customerDrawer;
    if (!group.userId) { toast.error("Cannot add extras: customer account not found."); return; }
    drawerInFlight.current = true;
    setDrawerLoading(true);
    try {
      const body = {
        customerId: group.userId,
        items: extraItems.map(({ productId, name, quantity, price, unit, variantId }) => ({
          productId,
          name,
          quantity: Number(quantity),
          price: Number(price),
          unit,
          ...(variantId ? { variantId } : {}),
        })),
        paymentMode,
        ...(subscriptionId ? { subscriptionId } : {}),
      };
      const res = await apiRequest("/api/order/admin/instant-delivery", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed to record extra products."); }
      setCustomerDrawer(null);
      toast.success("Extra products recorded.");
      await fetchBoard();
    } catch (err) {
      toast.error(err.message);
    } finally {
      drawerInFlight.current = false;
      setDrawerLoading(false);
    }
  }

  async function handleConfirmAll(group) {
    if (bulkLoading) return;
    const pending = group.items.filter((i) => i.canRecordOutcome);
    if (pending.length === 0) { toast.error("No pending items in this group."); return; }
    setBulkLoading(true);
    let success = 0;
    for (const item of pending) {
      try {
        const endpoint = item.type === "order"
          ? `/api/order/admin/${item.id}/delivery-outcome`
          : `/api/subscriptions/admin/${item.id}/delivery-outcome`;
        const body = item.type === "order"
          ? { status: "delivered", paymentMode: "pay_at_delivery" }
          : { status: "delivered", actualQuantity: Number(item.scheduledQuantity || item.quantity || 0) };
        const res = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) });
        if (res.ok) success++;
      } catch (err) {
        console.error("Confirm all error for item", item.id, err);
      }
    }
    if (success === 0) {
      toast.error("Failed to mark any items as delivered.");
    } else if (success < pending.length) {
      toast.success(`${success} of ${pending.length} marked delivered. Some failed.`);
    } else {
      toast.success(`All ${success} items marked delivered.`);
    }
    setBulkLoading(false);
    await fetchBoard();
  }

  async function handleOutcomeConfirm({ status, actualQuantity, reason, notes, paymentMode, subscriptionId }) {
    if (outcomeInFlight.current) return;
    outcomeInFlight.current = true;
    setOutcomeLoading(true);
    const { item } = outcomeModal;
    try {
      const endpoint = item.type === "order"
        ? `/api/order/admin/${item.id}/delivery-outcome`
        : `/api/subscriptions/admin/${item.id}/delivery-outcome`;
      const body = item.type === "order"
        ? { status, reason, notes, paymentMode: paymentMode || "pay_at_delivery", ...(subscriptionId ? { subscriptionId } : {}) }
        : { status, actualQuantity: Number(actualQuantity), reason, notes };
      const res = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Failed to record outcome."); }
      setOutcomeModal(null);
      toast.success(`Marked as ${status}.`);
      await fetchBoard();
    } catch (err) {
      toast.error(err.message);
    } finally {
      outcomeInFlight.current = false;
      setOutcomeLoading(false);
    }
  }

  async function handleBulkDeliver() {
    if (bulkLoading) return;
    const pending = deliveries.filter((d) => selectedIds.has(d.id) && d.canRecordOutcome !== false);
    if (pending.length === 0) {
      toast.error("No selected items can be marked delivered.");
      return;
    }
    setBulkLoading(true);
    let success = 0;
    for (const item of pending) {
      try {
        const endpoint = item.type === "order"
          ? `/api/order/admin/${item.id}/delivery-outcome`
          : `/api/subscriptions/admin/${item.id}/delivery-outcome`;
        const body = item.type === "order"
          ? { status: "delivered", paymentMode: "pay_at_delivery" }
          : { status: "delivered", actualQuantity: Number(item.scheduledQuantity || item.quantity || 0) };
        const res = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) });
        if (res.ok) success++;
      } catch (err) {
        console.error("Bulk delivery error for item", item.id, err);
      }
    }
    if (success === 0) {
      toast.error("Failed to mark any items as delivered.");
    } else if (success < pending.length) {
      toast.success(`${success} of ${pending.length} marked delivered. Some failed.`);
    } else {
      toast.success(`All ${success} items marked delivered.`);
    }
    setBulkLoading(false);
    setSelectedIds(new Set());
    await fetchBoard();
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const selectable = deliveries.filter((d) => d.canRecordOutcome !== false);
    if (selectedIds.size === selectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((d) => d.id)));
    }
  }

  const hasFilters = typeTab !== "all" || statusFilter !== "all" || !!searchValue.trim() || areaFilter !== "all";
  const clearFilters = () => {
    setSearchValue("");
    setTypeTab("all");
    setStatusFilter("all");
    setAreaFilter("all");
    setPage(1);
  };

  if (loading && !boardData) return <LoadingScreen text="Loading route..." />;
  if (error && !boardData) return <PageError message={error} onRetry={fetchBoard} />;

  return (
    <div className="view-stack delivery-board">
      <PageHeader
        className="delivery-page-header"
        title="Delivery Board"
        subtitle={`Live operations for ${formatDate(date)}`}
        actions={
          isMobile ? (
            <button className="filter-toggle-btn" onClick={() => setIsFilterSheetOpen(true)}>
              <Filter size={16} />
              <span>Filters</span>
            </button>
          ) : undefined
        }
      />

      <div className="surface delivery-surface">
        <div className="surface-filters">
          {!isMobile ? (
            <DeliveryFilters
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              date={date}
              onDateChange={setDate}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              typeTab={typeTab}
              onTypeChange={setTypeTab}
              areaFilter={areaFilter}
              onAreaChange={setAreaFilter}
              areas={areas}
              sortMode={sortMode}
              onSortModeChange={setSortMode}
            />
          ) : (
            <div className="mobile-filter-bar">
              <SearchInput value={searchValue} onChange={setSearchValue} placeholder="Search customer, phone, or product..." />
              <div className="mobile-quick-selects">
                {areas.length > 0 && (
                  <IconDropdown
                    icon={<MapPin size={13} className="df-icon-select-icon" aria-hidden />}
                    value={areaFilter}
                    onChange={setAreaFilter}
                    options={[
                      { value: "all", label: "All Areas" },
                      ...areas.map((a) => ({ value: a._id, label: a.name })),
                    ]}
                    ariaLabel="Filter by area"
                  />
                )}
                <IconDropdown
                  icon={<ListOrdered size={13} className="df-icon-select-icon" aria-hidden />}
                  value={sortMode}
                  onChange={setSortMode}
                  options={[
                    { value: "sequence", label: "By Sequence" },
                    { value: "name", label: "By Name" },
                  ]}
                  ariaLabel="Sort order"
                />
              </div>
            </div>
          )}
        </div>

      </div>

      <section className="delivery-list-section">
        <div className="list-header">
          <div className="list-header-left">
            <h3>Queue <span className="queue-count">({total} items · {customerGroups.length} customers on this page)</span></h3>
            <div className="delivery-inline-stats">
              <span className="dis-pending">{summary.remainingDeliveries || 0} pending</span>
              <span className="dis-sep">·</span>
              <span className="dis-done">{summary.completedDeliveries || 0} done</span>
              {(summary.exceptions || 0) > 0 && (
                <>
                  <span className="dis-sep">·</span>
                  <span className="dis-alert">{summary.exceptions} alert{summary.exceptions !== 1 ? "s" : ""}</span>
                </>
              )}
            </div>
          </div>
          {!isMobile && deliveries.some((d) => d.canRecordOutcome !== false) && (
             <div className="bulk-selection-controls">
                <label className="checkbox-label">
                  <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === deliveries.filter((d) => d.canRecordOutcome !== false).length} />
                  Select All (page)
                </label>
                {selectedIds.size > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={handleBulkDeliver} disabled={bulkLoading}>
                    <CheckSquare size={16} />
                    <span>{bulkLoading ? "Delivering…" : `Deliver (${selectedIds.size})`}</span>
                  </button>
                )}
             </div>
          )}
        </div>

        {loading && <div style={{ padding: "12px", textAlign: "center", color: "var(--text-muted)" }}>Updating…</div>}

        <div className="delivery-card-list">
          {customerGroups.length === 0 ? (
            <EmptyState
              text="No deliveries found."
              action={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
            />
          ) : (
            customerGroups.map((group) => (
              <CustomerDeliveryGroup
                key={group.userId || group.customerName}
                group={group}
                selectedIds={selectedIds}
                onSelect={toggleSelect}
                onAction={openOutcomeModal}
                onConfirmAll={handleConfirmAll}
                onOpenCustomerDrawer={isAdmin ? openCustomerDrawer : null}
              />
            ))
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} limit={PAGE_SIZE} onPageChange={setPage} showMeta />
      </section>

      <FilterSheet isOpen={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)}>
        <DeliveryFilters
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          date={date}
          onDateChange={setDate}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          typeTab={typeTab}
          onTypeChange={setTypeTab}
          areaFilter={areaFilter}
          onAreaChange={setAreaFilter}
          areas={areas}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
        />
      </FilterSheet>

      <OutcomeModal
        isMobile={isMobile}
        outcomeModal={outcomeModal}
        onClose={() => { if (!outcomeLoading) setOutcomeModal(null); }}
        onConfirm={handleOutcomeConfirm}
        loading={outcomeLoading}
        onFormChange={(updates) => setOutcomeModal(prev => prev ? ({ ...prev, form: { ...prev.form, ...updates } }) : prev)}
      />

      {isAdmin && customerDrawer && (
        <CustomerConfirmDrawer
          isMobile={isMobile}
          group={customerDrawer.group}
          onClose={() => { if (!drawerLoading) setCustomerDrawer(null); }}
          onConfirm={handleCustomerDrawerConfirm}
          loading={drawerLoading}
        />
      )}

      <BulkActionsBar
        selectedCount={selectedIds.size}
        onBulkDeliver={handleBulkDeliver}
        visible={selectedIds.size > 0}
        loading={bulkLoading}
      />
    </div>
  );
}
