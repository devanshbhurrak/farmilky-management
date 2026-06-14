import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { formatCurrency } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import EmptyState from "../components/ui/EmptyState";
import LoadingScreen from "../components/ui/LoadingScreen";
import Modal from "../components/ui/Modal";
import BottomSheet from "../components/ui/BottomSheet";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import ProductForm from "../components/product/ProductForm";
import toast from "react-hot-toast";
import { createApiFetch, useApiData } from "../hooks/useApiData";
import { categoryOptions } from "../utils/constants";
import { apiRequest, safeParseJson } from "../api/client";
import { useMediaQuery } from "../hooks/useMediaQuery";

const fetchProducts = createApiFetch("/api/products");

export default function ProductsPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data, loading, refetch } = useApiData(fetchProducts);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availFilter, setAvailFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", category: "milk", price: "", unit: "L", fatContent: "", stock: "", image: "", isAvailable: true });
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
    setForm({ name: "", description: "", category: "milk", price: "", unit: "L", fatContent: "", stock: "", image: "", isAvailable: true });
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
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, price: Number(form.price), stock: form.stock ? Number(form.stock) : undefined };
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

  const renderProductCard = (p) => (
    <div className="product-mobile-card" onClick={() => openEdit(p)}>
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
          <strong>{formatCurrency(p.price)} / {p.unit}</strong>
        </div>
        <div className="pm-stat">
          <span>Stock</span>
          <strong>{p.stock ?? "-"}</strong>
        </div>
      </div>
    </div>
  );

  const formContent = (
    <ProductForm
      form={form}
      onChange={(updates) => setForm(f => ({ ...f, ...updates }))}
      onSubmit={handleSave}
      saving={saving}
    />
  );

  if (loading && products.length === 0) return <LoadingScreen text="Loading products..." />;

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
          <div className="search-input-wrap">
            <input
              type="text"
              placeholder="Search products..."
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch("")} aria-label="Clear search">&times;</button>
            )}
          </div>
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
        </div>

        {isMobile && (
          <div className="product-add-bar">
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <Plus size={16} /> Add New Product
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="product-empty-wrap">
            <EmptyState text="No products found." />
          </div>
        ) : isMobile ? (
          <div className="product-card-list">
            {filtered.map(renderProductCard)}
          </div>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p._id} onClick={() => openEdit(p)} style={{ cursor: "pointer" }}>
                    <td>
                      {p.image ? <img src={p.image} alt={p.name} className="product-thumb" /> : "—"}
                    </td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.category}</td>
                    <td><strong>{formatCurrency(p.price)}</strong></td>
                    <td>{p.unit}</td>
                    <td>{p.stock ?? "—"}</td>
                    <td>
                      <StatusTag value={p.isAvailable ? "active" : "cancelled"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isMobile ? (
        <BottomSheet
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingProduct ? "Edit Product" : "Add Product"}
        >
          {formContent}
          <div className="product-sheet-actions">
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {editingProduct && (
              <button
                className="btn btn-secondary btn-delete"
                onClick={() => { setModalOpen(false); setDeleteConfirm(editingProduct); }}
              >
                Delete Product
              </button>
            )}
          </div>
        </BottomSheet>
      ) : (
        <Modal
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
                  {saving ? "Saving..." : "Save Product"}
                </button>
              </div>
            </div>
          }
        >
          {formContent}
        </Modal>
      )}

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
