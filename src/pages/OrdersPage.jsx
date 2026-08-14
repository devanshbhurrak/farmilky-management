import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Plus } from "lucide-react";
import { formatCurrency, formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import DataTable from "../components/ui/DataTable";
import FilterSheet from "../components/ui/FilterSheet";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import OrderForm from "../components/order/OrderForm";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { apiRequest, safeParseJson } from "../api/client";
import toast from "react-hot-toast";

export default function OrdersPage({ orders, onRefresh }) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ userId: "", items: [], address: { street: "", city: "", state: "", pincode: "" }, paymentMethod: "COD", paymentStatus: "pending", orderStatus: "confirmed" });

  useEffect(() => {
    if (modalOpen) {
      Promise.all([
        apiRequest("/api/products").then(r => r.json()),
        apiRequest("/api/user/admin/all").then(r => r.json())
      ]).then(([pData, cData]) => {
        setProducts(pData.products || pData || []);
        setCustomers(cData.users || cData || []);
      }).catch(() => {
        toast.error("Failed to load dependency data");
      });
    }
  }, [modalOpen]);

  const debouncedSearch = useMemo(() => search.trim(), [search]);

  const filtered = useMemo(() => {
    let items = orders || [];
    if (statusFilter !== "all") items = items.filter((o) => o.orderStatus === statusFilter);
    if (paymentFilter !== "all") items = items.filter((o) => o.paymentStatus === paymentFilter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (o) =>
          (o.userId?.name || "").toLowerCase().includes(q) ||
          (o.userId?.email || "").toLowerCase().includes(q) ||
          (o.userId?.phone || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [orders, statusFilter, paymentFilter, debouncedSearch]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [filtered]);

  function openCreate() {
    setForm({ userId: "", items: [{ productId: "", quantity: 1 }], address: { street: "", city: "", state: "", pincode: "" }, paymentMethod: "COD", paymentStatus: "pending", orderStatus: "confirmed" });
    setModalOpen(true);
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest("/api/order/admin/create", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const payload = await safeParseJson(res);
      if (!res.ok) throw new Error(payload?.message || "Failed to create order");
      
      toast.success("Order created successfully!");
      setModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: "userId.name",
      label: "Customer",
      render: (r) => (
        <>
          <strong>{r.userId?.name || "Unknown"}</strong>
          <span className="cell-sub">{r.userId?.phone || r.userId?.email || ""}</span>
        </>
      ),
    },
    { key: "createdAt", label: "Order Date", render: (r) => formatDate(r.createdAt) },
    {
      key: "totalAmount",
      label: "Amount",
      render: (r) => <strong>{formatCurrency(r.totalAmount)}</strong>,
    },
    {
      key: "paymentMethod",
      label: "Payment",
      render: (r) => (
        <div className="stack-cell">
          <span className="cell-sub">{r.paymentMethod}</span>
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

  const payStatusClass = { paid: "success", pending: "muted", failed: "danger" };

  const renderOrderCard = (order) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          <span className="mc-name">{order.userId?.name || "Unknown"}</span>
          <span className="mc-sub">
            {order.userId?.phone || order.userId?.email || ""}&nbsp;&middot;&nbsp;{formatDate(order.createdAt)}
          </span>
        </div>
        <StatusTag value={order.orderStatus} />
      </div>
      <div className="mc-stats">
        <div className="mc-stat">
          <span className="mc-stat-label">Amount</span>
          <span className="mc-stat-value">{formatCurrency(order.totalAmount)}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Method</span>
          <span className="mc-stat-value">{order.paymentMethod || "—"}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Payment</span>
          <span className={`mc-stat-value ${payStatusClass[order.paymentStatus] || "muted"}`}>
            {order.paymentStatus ? order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1) : "—"}
          </span>
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

  const formContent = (
    <OrderForm
      form={form}
      onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
      products={products}
      customers={customers}
      onSubmit={handleSave}
      saving={saving}
    />
  );

  return (
    <div className="orders-page view-stack">
      <PageHeader
        title="Orders"
        subtitle={`Showing ${sorted.length} orders total`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} /> Add Order
          </button>
        }
      />

      <div className="surface">
        <div className="surface-filters">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, email, phone..."
            aria-label="Search orders"
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

      <ResponsiveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Order"
        footer={
          <div className="product-modal-footer-right">
            <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Creating…" : "Create Order"}
            </button>
          </div>
        }
      >
        {formContent}
      </ResponsiveModal>
    </div>
  );
}
