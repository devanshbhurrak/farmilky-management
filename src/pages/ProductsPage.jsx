import { useState, useMemo } from "react";
import { Filter, Plus } from "lucide-react";
import { formatCurrency } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import LoadingScreen from "../components/ui/LoadingScreen";
import PageError from "../components/ui/PageError";
import DataTable from "../components/ui/DataTable";
import FilterSheet from "../components/ui/FilterSheet";
import ResponsiveModal from "../components/ui/ResponsiveModal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import ProductForm from "../components/product/ProductForm";
import toast from "react-hot-toast";
import { createApiFetch, useApiData } from "../hooks/useApiData";
import { categoryOptions } from "../utils/constants";
import { apiRequest, safeParseJson } from "../api/client";
import { useMediaQuery } from "../hooks/useMediaQuery";

const fetchProducts = createApiFetch("/api/products");

export default function ProductsPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data, loading, error, refetch } = useApiData(fetchProducts);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availFilter, setAvailFilter] = useState("all");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", category: "milk", price: "", unit: "L", fatContent: "", stock: "", image: "", isAvailable: true, variants: [] });
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const products = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.products && Array.isArray(data.products)) return data.products;
    return [];
  }, [data]);

  const filtered = useMemo(() => {
    let items = products;
    if (categoryFilter !== "all") items = items.filter((p) => p.category === categoryFilter);
    if (availFilter === "available") items = items.filter((p) => p.isAvailable);
    else if (availFilter === "unavailable") items = items.filter((p) => !p.isAvailable);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q));
    }
    return items;
  }, [products, categoryFilter, availFilter, search]);

  function openCreate() {
    setEditingProduct(null);
    setForm({ name: "", description: "", category: "milk", price: "", unit: "L", fatContent: "", stock: "", image: "", isAvailable: true, variants: [] });
    setModalOpen(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setForm({
      name: product.name || "",
      description: product.description || "",
      category: product.category || "milk",
      price: product.price || "",
      unit: product.unit || "L",
      fatContent: product.fatContent || "",
      stock: product.stock ?? "",
      image: product.image || "",
      isAvailable: product.isAvailable ?? true,
      variants: product.variants || [],
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        price: Number(form.price),
        stock: form.stock ? Number(form.stock) : undefined,
        variants: (form.variants || []).map(v => ({
          ...v,
          quantity: Number(v.quantity) || 0,
          price: Number(v.price) || 0,
          discountedPrice: v.discountedPrice !== '' && v.discountedPrice != null ? Number(v.discountedPrice) : null,
          stock: Number(v.stock) || 100,
        })),
      };
      const isUpdate = !!editingProduct;
      const res = await apiRequest(
        isUpdate ? `/api/products/${editingProduct._id}` : "/api/products",
        { method: isUpdate ? "PUT" : "POST", body: JSON.stringify(body) }
      );
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Save failed"); }
      toast.success(isUpdate ? "Product updated." : "Product created.");
      setModalOpen(false);
      await refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await apiRequest(`/api/products/${deleteConfirm._id}`, { method: "DELETE" });
      if (!res.ok) { const p = await safeParseJson(res); throw new Error(p?.message || "Delete failed"); }
      toast.success("Product deleted.");
      setDeleteConfirm(null);
      await refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const getProductPrice = (p) => {
    if (p.variants?.length > 0) {
      const def = p.variants.find((v) => v.isDefault) ?? p.variants[0];
      return formatCurrency(def.discountedPrice ?? def.price);
    }
    return `${formatCurrency(p.price)} / ${p.unit}`;
  };

  const columns = [
    {
      key: "name",
      label: "Product",
      sortable: false,
      render: (r) => (
        <div className="avatar-cell">
          {r.image ? (
            <img src={r.image} alt={r.name} className="product-thumb" />
          ) : (
            <div className="product-thumb product-thumb--empty" aria-hidden>
              —
            </div>
          )}
          <strong className="cell-title">{r.name}</strong>
        </div>
      ),
    },
    { key: "category", label: "Category", render: (r) => <span className="text-muted">{r.category}</span> },
    {
      key: "price",
      label: "Price",
      sortable: false,
      render: (r) => <strong>{getProductPrice(r)}</strong>,
    },
    {
      key: "unit",
      label: "Unit / Variants",
      sortable: false,
      render: (r) =>
        r.variants?.length > 0
          ? `${r.variants.length} variant${r.variants.length > 1 ? "s" : ""}`
          : r.unit || "—",
    },
    {
      key: "stock",
      label: "Stock",
      sortable: false,
      render: (r) =>
        r.variants?.length > 0
          ? r.variants.map((v) => `${v.label}: ${v.stock}`).join(", ")
          : (r.stock ?? "—"),
    },
    {
      key: "isAvailable",
      label: "Status",
      sortable: false,
      render: (r) => <StatusTag value={r.isAvailable ? "active" : "cancelled"} />,
    },
  ];

  const renderProductCard = (p) => (
    <div className="product-mobile-card">
      <div className="pm-card-header">
        {p.image && <img src={p.image} alt={p.name} className="pm-thumb" />}
        <div className="pm-title">
          <strong>{p.name}</strong>
          <span>{p.category}</span>
        </div>
        <StatusTag value={p.isAvailable ? "active" : "cancelled"} />
      </div>
      <div className="pm-card-body">
        <div className="pm-stat">
          <span>Price</span>
          <strong>{getProductPrice(p)}</strong>
        </div>
        <div className="pm-stat">
          <span>Stock</span>
          <strong>
            {p.variants?.length > 0
              ? `${p.variants.length} variant${p.variants.length > 1 ? "s" : ""}`
              : (p.stock ?? "-")}
          </strong>
        </div>
      </div>
    </div>
  );

  const filters = (
    <>
      <div className="form-group">
        <label>Category</label>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All Categories</option>
          {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Availability</label>
        <select value={availFilter} onChange={(e) => setAvailFilter(e.target.value)}>
          <option value="all">All Availability</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>
    </>
  );

  const hasFilters = categoryFilter !== "all" || availFilter !== "all" || !!search.trim();
  const clearFilters = () => {
    setCategoryFilter("all");
    setAvailFilter("all");
    setSearch("");
  };

  const formContent = (
    <ProductForm
      form={form}
      onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
      onSubmit={handleSave}
      saving={saving}
    />
  );

  if (loading && products.length === 0) return <LoadingScreen text="Loading products..." />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="view-stack products-page">
      <PageHeader
        title="Products"
        subtitle={`Managing ${products.length} products in inventory`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} /> Add Product
          </button>
        }
      />

      <div className="surface">
        <div className="surface-filters">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search products..."
            aria-label="Search products"
          />
          {!isMobile && (
            <div className="desktop-filters">
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={availFilter} onChange={(e) => setAvailFilter(e.target.value)}>
                <option value="all">All Availability</option>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          )}
          {isMobile && (
            <button
              className={`filter-toggle-btn${hasFilters ? " filter-toggle-btn--active" : ""}`}
              onClick={() => setIsFilterSheetOpen(true)}
            >
              <Filter size={16} />
              <span>Filters{hasFilters ? " •" : ""}</span>
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          renderCard={renderProductCard}
          onRowClick={openEdit}
          loading={loading}
          sortable={false}
          emptyText="No products found."
          noMatchAction={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
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
        title={editingProduct ? "Edit Product" : "Add Product"}
        footer={
          <div className="product-modal-footer">
            {editingProduct ? (
              <button
                className="btn btn-secondary btn-sm product-modal-delete"
                onClick={() => { setModalOpen(false); setDeleteConfirm(editingProduct); }}
              >
                Delete Product
              </button>
            ) : <div />}
            <div className="product-modal-footer-right">
              <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Product"}
              </button>
            </div>
          </div>
        }
      >
        {formContent}
      </ResponsiveModal>

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"?`}
        loading={deleting}
      />
    </div>
  );
}
