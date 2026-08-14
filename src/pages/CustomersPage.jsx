import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import PageError from "../components/ui/PageError";
import PageSkeleton from "../components/ui/PageSkeleton";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import CustomerForm from "../components/customer/CustomerForm";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest, safeParseJson } from "../api/client";
import toast from "react-hot-toast";

const fetchCustomers = createApiFetch("/api/user/admin/all");

function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.slice(0, 2) || "?").toUpperCase();
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApiData(fetchCustomers);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", role: "customer",
    address: { street: "", city: "", state: "", pincode: "" }, isActive: true,
  });

  const customers = useMemo(() => {
    if (!data) return [];
    const raw = Array.isArray(data) ? data : data?.users ?? [];
    return raw.filter((u) => u.role === "customer");
  }, [data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q)
    );
  }, [customers, search]);

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
          <div
            className={`cust-avatar cust-avatar--sm role-${r.role}`}
            aria-hidden="true"
          >
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
      key: "totalSpent",
      label: "Total Spent",
      render: (r) =>
        r.totalSpent != null ? (
          <strong>{formatCurrency(r.totalSpent)}</strong>
        ) : "—",
    },
    {
      key: "pendingAmount",
      label: "Pending",
      render: (r) =>
        r.pendingAmount != null ? (
          <strong className={r.pendingAmount > 0 ? "danger-text" : undefined}>
            {formatCurrency(r.pendingAmount)}
          </strong>
        ) : "—",
    },
    {
      key: "createdAt",
      label: "Joined",
      render: (r) => (
        <span className="text-muted">{formatDate(r.createdAt)}</span>
      ),
    },
  ];

  const renderCustomerCard = (user) => (
    <div className="cust-card">
      <div className="cust-card-head">
        <div className="cust-avatar" aria-hidden="true">
          {getInitials(user.name)}
        </div>
        <div className="cust-identity">
          <span className="cust-name">{user.name}</span>
          <span className="cust-sub">{user.phone || user.email || "—"}</span>
        </div>
        {user.pendingAmount > 0 && (
          <span className="cust-due-badge">{formatCurrency(user.pendingAmount)} due</span>
        )}
      </div>
      <div className="cust-card-stats">
        <div className="cust-card-stat">
          <span className="cust-card-stat-label">Total Spent</span>
          <span className="cust-card-stat-value">
            {user.totalSpent != null ? formatCurrency(user.totalSpent) : "—"}
          </span>
        </div>
        <div className="cust-card-stat">
          <span className="cust-card-stat-label">Outstanding</span>
          <span className={`cust-card-stat-value ${user.pendingAmount > 0 ? "danger" : "success"}`}>
            {user.pendingAmount != null ? formatCurrency(user.pendingAmount) : "—"}
          </span>
        </div>
        <div className="cust-card-stat">
          <span className="cust-card-stat-label">Joined</span>
          <span className="cust-card-stat-value muted">{formatDate(user.createdAt)}</span>
        </div>
      </div>
    </div>
  );

  const clearFilters = () => setSearch("");

  const formContent = (
    <CustomerForm
      form={form}
      onChange={(updates) => setForm((f) => ({ ...f, ...updates }))}
      onSubmit={handleSave}
      saving={saving}
    />
  );

  if (loading && customers.length === 0) return <PageSkeleton />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="customers-page view-stack">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customers`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} /> Add Customer
          </button>
        }
      />

      {/* Table + filters */}
      <div className="surface">
        <div className="surface-filters">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, email, phone..."
            aria-label="Search customers"
          />
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          renderCard={renderCustomerCard}
          onRowClick={(row) => navigate(`/customers/${row._id}`)}
          emptyText="No customers found."
          noMatchAction={search.trim() ? { label: "Clear filters", onClick: clearFilters } : undefined}
          defaultSortKey="createdAt"
          defaultSortDir="desc"
          pageSize={20}
        />
      </div>

      <ResponsiveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Customer"
        footer={
          <div className="product-modal-footer-right">
            <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Creating…" : "Create Customer"}
            </button>
          </div>
        }
      >
        {formContent}
      </ResponsiveModal>
    </div>
  );
}
