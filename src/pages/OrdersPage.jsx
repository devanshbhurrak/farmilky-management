import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Filter } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import ActionRow from "../components/ui/ActionRow";
import DataTable from "../components/ui/DataTable";
import FilterSheet from "../components/ui/FilterSheet";
import PageHeader from "../components/ui/PageHeader";
import { orderStatusOptions } from "../utils/constants";
import { useMediaQuery } from "../hooks/useMediaQuery";

export default function OrdersPage({ orders, onUpdate }) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    let items = orders || [];
    if (statusFilter !== "all") items = items.filter((o) => o.orderStatus === statusFilter);
    if (paymentFilter !== "all") items = items.filter((o) => o.paymentStatus === paymentFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (o) =>
          (o.userId?.name || "").toLowerCase().includes(q) ||
          (o.userId?.email || "").toLowerCase().includes(q) ||
          (o.userId?.phone || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [orders, statusFilter, paymentFilter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [filtered]);

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
    { key: "createdAt", label: "Order Date", render: (r) => formatDate(r.createdAt) },
    {
      key: "totalAmount",
      label: "Amount",
      render: (r) => <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(r.totalAmount)}</strong>,
    },
    {
      key: "paymentMethod",
      label: "Payment",
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontWeight: "bold", fontSize: "11px", color: "var(--text-muted)" }}>{r.paymentMethod}</span>
          <StatusTag value={r.paymentStatus} />
        </div>
      ),
    },
    {
      key: "orderStatus",
      label: "Status",
      render: (r) => <StatusTag value={r.orderStatus} />,
    },
  ];

  const renderOrderCard = (order) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          <span className="mc-name">{order.userId?.name || "Unknown"}</span>
          <span className="mc-sub">{order.paymentMethod} · {formatDate(order.createdAt)}</span>
        </div>
        <StatusTag value={order.orderStatus} />
      </div>
      <div className="mc-stats">
        <div className="mc-stat">
          <span className="mc-stat-label">Amount</span>
          <span className="mc-stat-value">{formatCurrency(order.totalAmount)}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Payment</span>
          <StatusTag value={order.paymentStatus} />
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Time</span>
          <span className="mc-stat-value muted">{order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
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
          <option value="placed">Placed</option>
          <option value="confirmed">Confirmed</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="form-group">
        <label>Payment</label>
        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="all">All Payments</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
        </select>
      </div>
    </>
  );

  const hasFilters = statusFilter !== "all" || paymentFilter !== "all" || !!search.trim();
  const clearFilters = () => {
    setStatusFilter("all");
    setPaymentFilter("all");
    setSearch("");
  };

  return (
    <div>
      <PageHeader 
        title="Orders" 
        subtitle={`Showing ${sorted.length} orders total`}
      />

      <div className="surface">
        <div className="surface-filters">
          <input
            type="text"
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          {!isMobile && (
            <div className="desktop-filters">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="placed">Placed</option>
                <option value="confirmed">Confirmed</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                <option value="all">All Payments</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
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
        <DataTable
          columns={columns}
          data={sorted}
          renderCard={renderOrderCard}
          onRowClick={(row) => navigate(`/orders/${row._id}`)}
          emptyText="No orders available."
          noMatchAction={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
          defaultSortKey="createdAt"
          defaultSortDir="desc"
        />
      </div>

      <FilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
      >
        {filters}
      </FilterSheet>
    </div>
  );
}
