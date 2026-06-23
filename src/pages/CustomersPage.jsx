import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Plus } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import EmptyState from "../components/ui/EmptyState";
import PageSkeleton from "../components/ui/PageSkeleton";
import DataTable from "../components/ui/DataTable";
import FilterSheet from "../components/ui/FilterSheet";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import BottomSheet from "../components/ui/BottomSheet";
import CustomerForm from "../components/customer/CustomerForm";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { useDebounce } from "../hooks/useDebounce";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { apiRequest, safeParseJson } from "../api/client";
import toast from "react-hot-toast";

const fetchCustomers = createApiFetch("/api/user/admin/all");

export default function CustomersPage({ onRefresh }) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data, loading, error, refetch } = useApiData(fetchCustomers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "customer", address: { street: "", city: "", state: "", pincode: "" }, isActive: true });

  const customers = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.users && Array.isArray(data.users)) return data.users;
    return [];
  }, [data]);

  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    let items = customers;
    if (roleFilter !== "all") items = items.filter((u) => u.role === roleFilter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.phone || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [customers, roleFilter, debouncedSearch]);

  function openCreate() {
    setForm({ name: "", email: "", phone: "", password: "", role: "customer", address: { street: "", city: "", state: "", pincode: "" }, isActive: true });
    setModalOpen(true);
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const body = { 
        ...form, 
        addresses: form.address.street ? [form.address] : [] 
      };
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
        <option value="agent">Delivery Agent</option>
        <option value="admin">Admin</option>
      </select>
    </div>
  );

  const hasFilters = roleFilter !== "all" || !!search.trim();
  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
  };

  const formContent = (
    <CustomerForm
      form={form}
      onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
      onSubmit={handleSave}
      saving={saving}
    />
  );

  if (loading && customers.length === 0) return <PageSkeleton />;
  if (error) return <EmptyState text={error} action={{ label: "Retry", onClick: refetch }} />;

  return (
    <div>
      <PageHeader 
        title="Customers" 
        subtitle={`Database contains ${customers.length} registered users`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} /> Add Customer
          </button>
        }
      />

      <div className="surface">
        <div className="surface-filters">
          <div className="search-input-wrap">
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch("")} aria-label="Clear search">&times;</button>
            )}
          </div>
          {!isMobile && (
            <div className="desktop-filters">
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">All Roles</option>
                <option value="customer">Customer</option>
                <option value="agent">Delivery Agent</option>
                <option value="admin">Admin</option>
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

      {isMobile ? (
        <BottomSheet
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Add Customer"
        >
          {formContent}
          <div className="product-sheet-actions" style={{ marginTop: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Customer"}
            </button>
          </div>
        </BottomSheet>
      ) : (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Add Customer"
          footer={
            <div className="product-modal-footer">
              <div />
              <div className="product-modal-footer-right">
                <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Creating..." : "Create Customer"}
                </button>
              </div>
            </div>
          }
        >
          {formContent}
        </Modal>
      )}
    </div>
  );
}
