import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, SlidersHorizontal } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageError from "../components/ui/PageError";
import PageSkeleton from "../components/ui/PageSkeleton";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import FilterSheet from "../components/ui/FilterSheet";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import CustomerForm from "../components/customer/CustomerForm";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { apiRequest, safeParseJson } from "../api/client";
import toast from "react-hot-toast";

function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2) || "?").toUpperCase();
}

// Client-side filter values
const STATUS_ALL = "all";
const BALANCE_ALL = "all";

export default function CustomersPage() {
  const navigate = useNavigate();

  // Server-side: search, sort, pagination
  const {
    data: customers,
    loading,
    error,
    pagination,
    search,
    sort,
    setPage,
    setLimit,
    setSearch,
    setSort,
    refetch,
  } = usePaginatedFetch("/api/user/admin/all", {
    initialLimit: 20,
    initialFilters: { role: "customer" },
    initialSort: { sortBy: "createdAt", sortOrder: "desc" },
    dataKey: "users",
  });

  // Client-side filters — applied on the fetched page of records
  const [statusFilter, setStatusFilter]   = useState(STATUS_ALL);  // "all" | "active" | "inactive"
  const [balanceFilter, setBalanceFilter] = useState(BALANCE_ALL); // "all" | "due" | "clear"

  const [filterOpen, setFilterOpen] = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", role: "customer",
    address: { street: "", city: "", state: "", pincode: "" }, isActive: true,
  });

  // Apply client-side filters on the current page's records
  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (statusFilter !== STATUS_ALL) {
      const want = statusFilter === "active";
      result = result.filter((c) => Boolean(c.isActive) === want);
    }
    if (balanceFilter !== BALANCE_ALL) {
      if (balanceFilter === "due")   result = result.filter((c) => (c.pendingAmount ?? 0) > 0);
      if (balanceFilter === "clear") result = result.filter((c) => (c.pendingAmount ?? 0) <= 0);
    }
    return result;
  }, [customers, statusFilter, balanceFilter]);

  const activeFilterCount = [
    statusFilter  !== STATUS_ALL,
    balanceFilter !== BALANCE_ALL,
  ].filter(Boolean).length;

  function clearLocalFilters() {
    setStatusFilter(STATUS_ALL);
    setBalanceFilter(BALANCE_ALL);
  }

  function openCreate() {
    setForm({
      name: "", email: "", phone: "", password: "", role: "customer",
      address: { street: "", city: "", state: "", pincode: "" }, isActive: true,
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, addresses: form.address.street ? [form.address] : [] };
      const res = await apiRequest("/api/user/admin/create", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const payload = await safeParseJson(res);
      if (!res.ok) throw new Error(payload?.message || "Failed to create customer");
      toast.success("Customer created successfully!");
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: "name",
      label: "Customer",
      render: (r) => (
        <div className="avatar-cell">
          <div className={`cust-avatar cust-avatar--sm role-${r.role}`} aria-hidden="true">
            {getInitials(r.name)}
          </div>
          <div>
            <strong className="cell-title">{r.name}</strong>
            <span className="cell-sub">{r.phone || r.email || "—"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (r) => <StatusTag value={r.isActive ? "active" : "inactive"} />,
    },
    {
      key: "pendingAmount",
      label: "Balance",
      render: (r) =>
        r.pendingAmount != null ? (
          <strong className={r.pendingAmount > 0 ? "danger-text" : "success-text"}>
            {formatCurrency(r.pendingAmount)}
          </strong>
        ) : "—",
    },
    {
      key: "createdAt",
      label: "Joined",
      render: (r) => <span className="text-muted">{formatDate(r.createdAt)}</span>,
    },
  ];

  const renderCustomerCard = (user) => (
    <div className="cust-card">
      <div className={`cust-avatar role-${user.role}`} aria-hidden="true">
        {getInitials(user.name)}
      </div>
      <div className="cust-identity">
        <span className="cust-name">{user.name}</span>
        <span className="cust-sub">{user.phone || user.email || "—"}</span>
      </div>
      <div className="cust-card-right">
        <StatusTag value={user.isActive ? "active" : "inactive"} />
        <span className={`cust-balance ${(user.pendingAmount ?? 0) > 0 ? "due" : "clear"}`}>
          {formatCurrency(user.pendingAmount ?? 0)}
        </span>
      </div>
    </div>
  );

  if (loading && customers.length === 0) return <PageSkeleton />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="customers-page view-stack">
      <PageHeader
        title="Customers"
        subtitle={`${pagination.total} customer${pagination.total !== 1 ? "s" : ""}`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} /> Add Customer
          </button>
        }
      />

      <div className="surface">
        <div className="surface-filters">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, email, phone..."
            aria-label="Search customers"
          />
          <button
            className={`filter-toggle-btn${activeFilterCount > 0 ? " filter-toggle-btn--active" : ""}`}
            onClick={() => setFilterOpen(true)}
            type="button"
            aria-label="Open filters"
          >
            <SlidersHorizontal size={15} />
            {activeFilterCount > 0 && (
              <span className="filter-toggle-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>

        <DataTable
          columns={columns}
          data={filteredCustomers}
          loading={loading}
          renderCard={renderCustomerCard}
          onRowClick={(row) => navigate(`/customers/${row._id}`)}
          emptyText={activeFilterCount > 0 ? "No customers match the selected filters." : "No customers found."}
          noMatchAction={
            activeFilterCount > 0
              ? { label: "Clear filters", onClick: clearLocalFilters }
              : search.trim()
              ? { label: "Clear search", onClick: () => setSearch("") }
              : undefined
          }
          pagination={{ ...pagination, onPageChange: setPage, onLimitChange: setLimit }}
          sortBy={sort.sortBy}
          sortOrder={sort.sortOrder}
          onSortChange={(key, dir) => setSort(key, dir)}
          serverSide
        />
      </div>

      {/* Filter sheet */}
      <FilterSheet isOpen={filterOpen} onClose={() => setFilterOpen(false)}>
        <div className="cust-filter-group">
          <span className="cust-filter-label">Status</span>
          <div className="cust-filter-options">
            {[
              { label: "All",      value: STATUS_ALL  },
              { label: "Active",   value: "active"    },
              { label: "Inactive", value: "inactive"  },
            ].map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={`cust-filter-chip${statusFilter === value ? " active" : ""}`}
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="cust-filter-group">
          <span className="cust-filter-label">Balance</span>
          <div className="cust-filter-options">
            {[
              { label: "All",      value: BALANCE_ALL },
              { label: "Has Due",  value: "due"       },
              { label: "Clear",    value: "clear"     },
            ].map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={`cust-filter-chip${balanceFilter === value ? " active" : ""}`}
                onClick={() => setBalanceFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="cust-filter-group">
          <span className="cust-filter-label">Sort By</span>
          <div className="cust-filter-options">
            {[
              { label: "Newest",      sortBy: "createdAt",    sortOrder: "desc" },
              { label: "Oldest",      sortBy: "createdAt",    sortOrder: "asc"  },
              { label: "Name A–Z",    sortBy: "name",         sortOrder: "asc"  },
              { label: "Name Z–A",    sortBy: "name",         sortOrder: "desc" },
              { label: "Highest Due", sortBy: "pendingAmount",sortOrder: "desc" },
            ].map(({ label, sortBy, sortOrder }) => (
              <button
                key={label}
                type="button"
                className={`cust-filter-chip${sort.sortBy === sortBy && sort.sortOrder === sortOrder ? " active" : ""}`}
                onClick={() => { setSort(sortBy, sortOrder); setFilterOpen(false); }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => { clearLocalFilters(); setFilterOpen(false); }}
          >
            Clear filters
          </button>
        )}
      </FilterSheet>

      <ResponsiveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Customer"
        footer={
          <div className="product-modal-footer">
            <div />
            <div className="product-modal-footer-right">
              <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? "Creating…" : "Create Customer"}
              </button>
            </div>
          </div>
        }
      >
        <CustomerForm
          form={form}
          onChange={(updates) => setForm((f) => ({ ...f, ...updates }))}
          onSubmit={handleSave}
          saving={saving}
        />
      </ResponsiveModal>
    </div>
  );
}
