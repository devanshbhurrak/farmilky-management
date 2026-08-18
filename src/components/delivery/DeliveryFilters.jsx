import { Search, Calendar, MapPin, ListOrdered, Filter } from "lucide-react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import IconDropdown from "../ui/IconDropdown";

const SORT_OPTIONS = [
  { value: "sequence", label: "By Sequence" },
  { value: "name",     label: "By Name" },
];

const STATUS_OPTIONS = [
  { value: "all",       label: "All Status" },
  { value: "pending",   label: "Pending" },
  { value: "delivered", label: "Delivered" },
  { value: "partial",   label: "Partial" },
  { value: "extra",     label: "Extra" },
  { value: "skipped",   label: "Skipped" },
  { value: "failed",    label: "Failed" },
];

const TYPE_OPTIONS = [
  { value: "all",          label: "All" },
  { value: "subscription", label: "Subscriptions" },
  { value: "order",        label: "Orders" },
];

export default function DeliveryFilters({
  searchValue,
  onSearchChange,
  date,
  onDateChange,
  statusFilter,
  onStatusChange,
  typeTab,
  onTypeChange,
  areaFilter,
  onAreaChange,
  areas,
  sortMode,
  onSortModeChange,
}) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  const areaOptions = [
    { value: "all", label: "All Areas" },
    ...(areas || []).map((a) => ({ value: a._id, label: a.name })),
  ];

  // Mobile: rendered inside FilterSheet
  if (isMobile) {
    return (
      <div className="delivery-filters-content">
        <div className="form-group">
          <label>Route Date</label>
          <div className="input-wrapper">
            <Calendar size={18} className="input-icon" aria-hidden />
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
        </div>

        {areas?.length > 0 && (
          <div className="form-group">
            <label>Area</label>
            <select value={areaFilter} onChange={(e) => onAreaChange(e.target.value)}>
              {areaOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>Status</label>
          <div className="filter-pill-group">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                className={statusFilter === s.value ? "filter-pill active" : "filter-pill"}
                onClick={() => onStatusChange(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Sort By</label>
          <div className="filter-pill-group">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                className={sortMode === s.value ? "filter-pill active" : "filter-pill"}
                onClick={() => onSortModeChange(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Type</label>
          <div className="filter-pill-group">
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t.value}
                className={typeTab === t.value ? "filter-pill active" : "filter-pill"}
                onClick={() => onTypeChange(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div className="delivery-filters-desktop">
      {/* Row 1: Search + Date */}
      <div className="df-row df-row--primary">
        <div className="df-search-box">
          <Search size={16} aria-hidden />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search customer, phone, or product…"
          />
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="date-input-desktop"
          aria-label="Route date"
        />
      </div>

      {/* Row 2: Type tabs */}
      <div className="df-row df-row--tabs">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t.value}
            className={`filter-tab ${typeTab === t.value ? "active" : ""}`}
            onClick={() => onTypeChange(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Row 3: Area + Sort + Status quick dropdowns */}
      <div className="df-row df-row--quick">
        {areas?.length > 0 && (
          <IconDropdown
            icon={<MapPin size={13} className="df-icon-select-icon" aria-hidden />}
            value={areaFilter}
            onChange={onAreaChange}
            options={areaOptions}
            ariaLabel="Filter by area"
          />
        )}
        <IconDropdown
          icon={<Filter size={13} className="df-icon-select-icon" aria-hidden />}
          value={statusFilter}
          onChange={onStatusChange}
          options={STATUS_OPTIONS}
          ariaLabel="Filter by status"
        />
        <IconDropdown
          icon={<ListOrdered size={13} className="df-icon-select-icon" aria-hidden />}
          value={sortMode}
          onChange={onSortModeChange}
          options={SORT_OPTIONS}
          ariaLabel="Sort order"
        />
      </div>
    </div>
  );
}
