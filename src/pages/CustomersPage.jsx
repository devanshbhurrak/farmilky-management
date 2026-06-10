import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Filter } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import EmptyState from "../components/ui/EmptyState";
import PageSkeleton from "../components/ui/PageSkeleton";
import DataTable from "../components/ui/DataTable";
import FilterSheet from "../components/ui/FilterSheet";
import PageHeader from "../components/ui/PageHeader";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { useMediaQuery } from "../hooks/useMediaQuery";

const fetchCustomers = createApiFetch("/api/user/admin/all");

export default function CustomersPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data, loading, error, refetch } = useApiData(fetchCustomers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const customers = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.users && Array.isArray(data.users)) return data.users;
    return [];
  }, [data]);

  const filtered = useMemo(() => {
    let items = customers;
    if (roleFilter !== "all") items = items.filter((u) => u.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.phone || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [customers, roleFilter, search]);

  const columns = [
    {
      key: "name",
      label: "Customer",
      render: (r) => (
        <>
          <strong>{r.name}</strong>
          <span>{r.phone || r.email || "-"}</span>
        </>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (r) => <StatusTag value={r.role} />,
    },
    {
      key: "totalSpent",
      label: "Total Spent",
      render: (r) => (r.totalSpent != null ? <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(r.totalSpent)}</strong> : "-"),
    },
    {
      key: "pendingAmount",
      label: "Pending",
      render: (r) => (r.pendingAmount != null ? <strong style={{ color: r.pendingAmount > 0 ? "var(--danger)" : "inherit" }}>{formatCurrency(r.pendingAmount)}</strong> : "-"),
    },
    {
      key: "createdAt",
      label: "Joined",
      render: (r) => formatDate(r.createdAt),
    },
  ];

  const renderCustomerCard = (user) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          <span className="mc-name">{user.name}</span>
          <span className="mc-sub">{user.phone || user.email || "—"}</span>
        </div>
        <StatusTag value={user.role} />
      </div>
      <div className="mc-stats">
        <div className="mc-stat">
          <span className="mc-stat-label">Spent</span>
          <span className="mc-stat-value">{user.totalSpent != null ? formatCurrency(user.totalSpent) : "—"}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Pending</span>
          <span className={`mc-stat-value ${user.pendingAmount > 0 ? "danger" : "muted"}`}>
            {user.pendingAmount != null ? formatCurrency(user.pendingAmount) : "—"}
          </span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Joined</span>
          <span className="mc-stat-value muted">{formatDate(user.createdAt)}</span>
        </div>
      </div>
    </>
  );

  const filters = (
    <div className="form-group">
      <label>Role</label>
      <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
        <option value="all">All Roles</option>
        <option value="customer">Customer</option>
        <option value="admin">Admin</option>
        <option value="delivery_partner">Delivery Partner</option>
      </select>
    </div>
  );

  const hasFilters = roleFilter !== "all" || !!search.trim();
  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
  };

  if (loading) return <PageSkeleton />;
  if (error) return <EmptyState text={error} action={{ label: "Retry", onClick: refetch }} />;

  return (
    <div>
      <PageHeader 
        title="Customers" 
        subtitle={`Database contains ${customers.length} registered users`}
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
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">All Roles</option>
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
                <option value="delivery_partner">Delivery Partner</option>
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
          data={filtered}
          renderCard={renderCustomerCard}
          onRowClick={(row) => navigate(`/customers/${row._id}`)}
          emptyText="No customers found."
          noMatchAction={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
          defaultSortKey="createdAt"
          defaultSortDir="desc"
          pageSize={20}
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
