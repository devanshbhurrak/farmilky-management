import { Filter, CheckSquare, MapPin, ListOrdered } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import IconDropdown from "../components/ui/IconDropdown";
import { useState, useMemo, useEffect, useCallback } from "react";
import { formatDate, todayLocal } from "../utils/format";
import EmptyState from "../components/ui/EmptyState";
import LoadingScreen from "../components/ui/LoadingScreen";
import FilterSheet from "../components/ui/FilterSheet";
import DeliveryCard from "../components/delivery/DeliveryCard";
import OutcomeModal from "../components/delivery/OutcomeModal";
import BulkActionsBar from "../components/delivery/BulkActionsBar";
import DeliveryFilters from "../components/delivery/DeliveryFilters";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest, safeParseJson } from "../api/client";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

const fetchBoard = createApiFetch("/api/subscriptions/admin/delivery-board");

export default function DeliveriesPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [date, setDate] = useState(todayLocal);
  const [searchValue, setSearchValue] = useState("");
  const [typeTab, setTypeTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [sortMode, setSortMode] = useState("sequence");
  const [outcomeModal, setOutcomeModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [areas, setAreas] = useState([]);
  const PAGE_SIZE = 50;

  const queryParams = useMemo(() => ({ date, type: typeTab !== "all" ? typeTab : undefined, status: statusFilter !== "all" ? statusFilter : undefined }), [date, typeTab, statusFilter]);
  const fetchFn = useCallback(() => fetchBoard(queryParams), [queryParams]);
  const { data, loading, refetch } = useApiData(fetchFn, false);

  useEffect(() => { refetch(); }, [refetch, queryParams]);

  useEffect(() => {
    apiRequest("/api/areas")
      .then((r) => r.json())
      .then((d) => setAreas(d.areas || []))
      .catch(() => {});
  }, []);

  const deliveryBoard = useMemo(() => data || {}, [data]);
  const summary = useMemo(() => deliveryBoard.summary || {}, [deliveryBoard]);
  const deliveries = useMemo(() => deliveryBoard.deliveries || [], [deliveryBoard]);

  const filteredDeliveries = useMemo(() => {
    let items = deliveries;
    const query = searchValue.trim().toLowerCase();
    if (query) {
      items = items.filter((item) =>
        [item.customerName, item.phone, item.email, item.productLabel, item.schedule, item.address, item.type, item.areaName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }
    if (areaFilter !== "all") {
      items = items.filter((item) => item.areaId === areaFilter);
    }
    if (sortMode === "sequence") {
      items = [...items].sort((a, b) => {
        if (a.canRecordOutcome !== b.canRecordOutcome) return a.canRecordOutcome ? -1 : 1;
        if (a.sequence == null && b.sequence == null) return (a.customerName || "").localeCompare(b.customerName || "");
        if (a.sequence == null) return 1;
        if (b.sequence == null) return -1;
        return a.sequence - b.sequence;
      });
    } else {
      items = [...items].sort((a, b) => {
        if (a.canRecordOutcome !== b.canRecordOutcome) return a.canRecordOutcome ? -1 : 1;
        return (a.customerName || "").localeCompare(b.customerName || "");
      });
    }
    return items;
  }, [deliveries, searchValue, areaFilter, sortMode]);

  const totalPages = Math.ceil(filteredDeliveries.length / PAGE_SIZE);
  const pagedDeliveries = useMemo(
    () => filteredDeliveries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredDeliveries, page]
  );

  function openOutcomeModal(item, mode) {
    setOutcomeModal({ item, mode, form: {} });
  }

  async function handleOutcomeConfirm({ status, actualQuantity, reason, notes, paymentMode, subscriptionId }) {
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
      await refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleBulkDeliver() {
    const pending = filteredDeliveries.filter((d) => selectedIds.has(d.id) && d.canRecordOutcome !== false);
    if (pending.length === 0) {
      toast.error("No selected items can be marked delivered.");
      return;
    }
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
    toast.success(`${success} of ${pending.length} marked delivered.`);
    setSelectedIds(new Set());
    await refetch();
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const selectable = filteredDeliveries.filter((d) => d.canRecordOutcome !== false);
    if (selectedIds.size === selectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((d) => d.id)));
    }
  }

  const hasFilters = typeTab !== "all" || statusFilter !== "all" || !!searchValue.trim();
  const clearFilters = () => {
    setSearchValue("");
    setTypeTab("all");
    setStatusFilter("all");
    setPage(1);
  };

  useEffect(() => { setPage(1); }, [searchValue, typeTab, statusFilter, date, areaFilter, sortMode]);

  if (loading && (!data || deliveries.length === 0)) return <LoadingScreen text="Loading route..." />;

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
            <h3>Queue <span className="queue-count">({filteredDeliveries.length})</span></h3>
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
          {!isMobile && filteredDeliveries.some((d) => d.canRecordOutcome !== false) && (
             <div className="bulk-selection-controls">
                <label className="checkbox-label">
                  <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === filteredDeliveries.filter((d) => d.canRecordOutcome !== false).length} />
                  Select All
                </label>
                {selectedIds.size > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={handleBulkDeliver}>
                    <CheckSquare size={16} />
                    <span>Deliver ({selectedIds.size})</span>
                  </button>
                )}
             </div>
          )}
        </div>

        <div className="delivery-card-list">
          {filteredDeliveries.length === 0 ? (
            <EmptyState
              text="No deliveries found."
              action={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
            />
          ) : (
            pagedDeliveries.map((item, index) => (
              <DeliveryCard
                key={`${item.type}-${item.id}`}
                item={item}
                index={(page - 1) * PAGE_SIZE + index}
                isSelected={selectedIds.has(item.id)}
                onSelect={toggleSelect}
                onAction={openOutcomeModal}
              />
            ))
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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
        onClose={() => setOutcomeModal(null)}
        onConfirm={handleOutcomeConfirm}
        onFormChange={(updates) => setOutcomeModal(prev => prev ? ({ ...prev, form: { ...prev.form, ...updates } }) : prev)}
      />

      <BulkActionsBar 
        selectedCount={selectedIds.size} 
        onBulkDeliver={handleBulkDeliver}
        visible={selectedIds.size > 0}
      />
    </div>
  );
}
