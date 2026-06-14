import { Search, Calendar } from "lucide-react";
import { useMediaQuery } from "../../hooks/useMediaQuery";

export default function DeliveryFilters({ 
  searchValue, 
  onSearchChange, 
  date, 
  onDateChange, 
  statusFilter, 
  onStatusChange, 
  typeTab, 
  onTypeChange 
}) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const dateId = "route-date";
  const searchId = "delivery-search";

  const statuses = [
    { value: "all", label: "All Status" },
    { value: "pending", label: "Pending" },
    { value: "delivered", label: "Delivered" },
    { value: "skipped", label: "Skipped" },
    { value: "failed", label: "Failed" },
  ];

  const renderContent = () => (
    <div className="delivery-filters-content">
      <div className="form-group">
        <label htmlFor={dateId}>Route Date</label>
        <div className="input-wrapper">
          <Calendar size={18} className="input-icon" aria-hidden />
          <input
            id={dateId}
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Status</label>
        <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Type</label>
        <div className="filter-pill-group">
          {["all", "subscription", "order"].map((t) => (
            <button
              key={t}
              className={typeTab === t ? "filter-pill active" : "filter-pill"}
              onClick={() => onTypeChange(t)}
            >
              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (isMobile) return renderContent();

  return (
    <div className="delivery-filters-desktop">
      <div className="search-row">
        <div className="search-box">
          <Search size={18} aria-hidden />
          <input
            id={searchId}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search customer, phone, or product"
          />
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="date-input-desktop"
          aria-label="Route date"
        />
        <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}
          aria-label="Filter by status">
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <div role="tablist" aria-label="Delivery type" className="tab-row">
        {["all", "subscription", "order"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={typeTab === t}
            className={typeTab === t ? "tab active" : "tab"}
            onClick={() => onTypeChange(t)}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
