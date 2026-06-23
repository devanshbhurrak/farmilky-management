import { Search, Filter, CheckSquare } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import { useState, useMemo, useEffect, useCallback } from "react";
import { formatDate } from "../utils/format";
import EmptyState from "../components/ui/EmptyState";
import LoadingScreen from "../components/ui/LoadingScreen";
import FilterSheet from "../components/ui/FilterSheet";
import MetricChip from "../components/ui/MetricChip";
import DeliveryCard from "../components/delivery/DeliveryCard";
import OutcomeModal from "../components/delivery/OutcomeModal";
import BulkActionsBar from "../components/delivery/BulkActionsBar";
import DeliveryFilters from "../components/delivery/DeliveryFilters";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { useDebounce } from "../hooks/useDebounce";
import { apiRequest, safeParseJson } from "../api/client";
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from "react-hot-toast";

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const fetchBoard = createApiFetch("/api/subscriptions/admin/delivery-board");

export default function DeliveriesPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [date, setDate] = useState(todayStr);
  const [searchValue, setSearchValue] = useState("");
  const [typeTab, setTypeTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [outcomeModal, setOutcomeModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const queryParams = useMemo(() => ({ date, type: typeTab !== "all" ? typeTab : undefined, status: statusFilter !== "all" ? statusFilter : undefined }), [date, typeTab, statusFilter]);
  const fetchFn = useCallback(() => fetchBoard(queryParams), [queryParams]);
  const { data, loading, refetch } = useApiData(fetchFn, false);

  useEffect(() => { refetch(); }, [refetch]);

  const deliveryBoard = useMemo(() => data || {}, [data]);
  const summary = useMemo(() => deliveryBoard.summary || {}, [deliveryBoard]);
  const deliveries = useMemo(() => deliveryBoard.deliveries || [], [deliveryBoard]);
  const debouncedSearch = useDebounce(searchValue, 300);

  const filteredDeliveries = useMemo(() => {
    let items = deliveries;
    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      items = items.filter((item) =>
        [item.customerName, item.phone, item.email, item.productLabel, item.schedule, item.address, item.type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }
    return items;
  }, [deliveries, debouncedSearch]);

  const totalPages = Math.ceil(filteredDeliveries.length / PAGE_SIZE);
  const pagedDeliveries = useMemo(
    () => filteredDeliveries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredDeliveries, page]
  );

  function openOutcomeModal(item, mode) {
    setOutcomeModal({ item, mode, form: {} });
  }

  async function handleOutcomeConfirm({ status, actualQuantity, reason, notes }) {
    const { item } = outcomeModal;
    try {
      const endpoint = item.type === "order"
        ? `/api/order/admin/${item.id}/delivery-outcome`
        : `/api/subscriptions/admin/${item.id}/delivery-outcome`;
      const body = item.type === "order"
        ? { status, reason, notes }
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
          ? { status: "delivered" }
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

  useEffect(() => { setPage(1); }, [debouncedSearch, typeTab, statusFilter, date]);

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
            />
          ) : (
            <div className="search-input-wrap">
              <input
                type="text"
                className="search-input"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search customer, phone, or product..."
              />
              {searchValue && (
                <button className="search-clear-btn" onClick={() => setSearchValue("")} aria-label="Clear search">&times;</button>
              )}
            </div>
          )}
        </div>

        <div className="delivery-summary-row">
          {isMobile ? (
            <div className="mobile-metric-strip">
              <MetricChip label="Pending" value={summary.remainingDeliveries || 0} />
              <MetricChip label="Done" value={summary.completedDeliveries || 0} />
              <MetricChip label="Alerts" value={summary.exceptions || 0} />
            </div>
          ) : (
            <div className="card-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="card-inset" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <span style={{ fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-bold)", color: "var(--text-muted)" }}>PENDING STOPS</span>
                 <strong style={{ fontSize: "var(--font-size-xl)" }}>{summary.remainingDeliveries || 0}</strong>
              </div>
              <div className="card-inset" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <span style={{ fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-bold)", color: "var(--text-muted)" }}>COMPLETED</span>
                 <strong style={{ fontSize: "var(--font-size-xl)", color: "var(--color-primary)" }}>{summary.completedDeliveries || 0}</strong>
              </div>
              <div className="card-inset" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <span style={{ fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-bold)", color: "var(--text-muted)" }}>EXCEPTIONS</span>
                 <strong style={{ fontSize: "var(--font-size-xl)", color: "var(--danger)" }}>{summary.exceptions || 0}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="delivery-list-section">
        <div className="list-header">
          <h3>Queue ({filteredDeliveries.length})</h3>
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
        {totalPages > 1 && (
          <div className="pagination-row" style={{ display: "flex", gap: "8px", justifyContent: "center", padding: "16px 0" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <span style={{ alignSelf: "center", fontSize: "var(--font-size-sm)" }}>{page} / {totalPages}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
          </div>
        )}
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
        />
      </FilterSheet>

      <OutcomeModal
        isMobile={isMobile}
        outcomeModal={outcomeModal}
        onClose={() => setOutcomeModal(null)}
        onConfirm={handleOutcomeConfirm}
        onFormChange={(updates) => setOutcomeModal(prev => ({ ...prev, form: { ...prev.form, ...updates } }))}
      />

      <BulkActionsBar 
        selectedCount={selectedIds.size} 
        onBulkDeliver={handleBulkDeliver}
        visible={selectedIds.size > 0}
      />
    </div>
  );
}
