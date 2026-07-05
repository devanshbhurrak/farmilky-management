import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import BottomSheet from "../components/ui/BottomSheet";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import StatusTag from "../components/ui/StatusTag";
import LoadingScreen from "../components/ui/LoadingScreen";
import toast from "react-hot-toast";
import { useMediaQuery } from "../hooks/useMediaQuery";

const fetchSuppliers = createApiFetch("/api/suppliers");

const EMPTY_FORM = {
  name: "", phone: "", email: "", location: "", pincode: "",
  joiningDate: new Date().toISOString().split("T")[0],
  collectionSessions: ["morning", "evening"],
  defaultMorningQty: "", defaultEveningQty: "",
  defaultRatePerLiter: "",
  bankDetails: { accountNo: "", ifscCode: "", bankName: "", holderName: "" },
  notes: "",
};

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

function formatCurrency(val) {
  return `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SuppliersPage() {
  const navigate = useNavigate();
  const { data, loading, refetch } = useApiData(fetchSuppliers);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const suppliers = data?.suppliers ?? [];

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const filtered = useMemo(() => {
    let result = suppliers;
    if (statusFilter === "active") result = result.filter((s) => s.isActive);
    if (statusFilter === "inactive") result = result.filter((s) => !s.isActive);
    return result;
  }, [suppliers, statusFilter]);

  const openCreate = useCallback(() => {
    setEditingSupplier(null);
    setForm({ ...EMPTY_FORM });
    setModalMode("create");
  }, []);

  const openEdit = useCallback((supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      location: supplier.location || "",
      pincode: supplier.pincode || "",
      joiningDate: supplier.joiningDate
        ? new Date(supplier.joiningDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      collectionSessions: supplier.collectionSessions || ["morning", "evening"],
      defaultMorningQty: supplier.defaultMorningQty?.toString() || "",
      defaultEveningQty: supplier.defaultEveningQty?.toString() || "",
      defaultRatePerLiter: supplier.defaultRatePerLiter?.toString() || "",
      bankDetails: supplier.bankDetails || { accountNo: "", ifscCode: "", bankName: "", holderName: "" },
      notes: supplier.notes || "",
    });
    setModalMode("edit");
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingSupplier(null);
  }, []);

  const handleSessionToggle = useCallback((session) => {
    setForm((prev) => {
      const sessions = prev.collectionSessions.includes(session)
        ? prev.collectionSessions.filter((s) => s !== session)
        : [...prev.collectionSessions, session];
      return { ...prev, collectionSessions: sessions };
    });
  }, []);

  const handleBankChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, bankDetails: { ...prev.bankDetails, [field]: value } }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name || !form.phone) {
      toast.error("Name and phone are required.");
      return;
    }
    if (form.collectionSessions.length === 0) {
      toast.error("Select at least one collection session.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        location: form.location,
        pincode: form.pincode,
        joiningDate: form.joiningDate || null,
        collectionSessions: form.collectionSessions,
        defaultMorningQty: form.defaultMorningQty ? parseFloat(form.defaultMorningQty) : 0,
        defaultEveningQty: form.defaultEveningQty ? parseFloat(form.defaultEveningQty) : 0,
        defaultRatePerLiter: form.defaultRatePerLiter ? parseFloat(form.defaultRatePerLiter) : 0,
        bankDetails: form.bankDetails,
        notes: form.notes,
      };

      const url = modalMode === "create" ? "/api/suppliers" : `/api/suppliers/${editingSupplier._id}`;
      const method = modalMode === "create" ? "POST" : "PUT";

      const res = await apiRequest(url, { method, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to save supplier.");

      toast.success(modalMode === "create" ? "Supplier added." : "Supplier updated.");
      closeModal();
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, modalMode, editingSupplier, closeModal, refetch]);

  const handleToggleStatus = useCallback(async () => {
    if (!confirmAction || confirmAction.type !== "toggle") return;
    const supplier = confirmAction.supplier;
    try {
      const res = await apiRequest(`/api/suppliers/${supplier._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !supplier.isActive }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success(result.message);
      setConfirmAction(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }, [confirmAction, refetch]);

  const handleDelete = useCallback(async () => {
    if (!confirmAction || confirmAction.type !== "delete") return;
    const supplier = confirmAction.supplier;
    try {
      const res = await apiRequest(`/api/suppliers/${supplier._id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success(result.message);
      setConfirmAction(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }, [confirmAction, refetch]);

  const supplierFormContent = (
    <div className="supplier-form">
      {/* ── Basic Info ── */}
      <div className="supplier-form-section">
        <p className="eyebrow">Basic Information</p>
        <div className="form-grid">
          <label className="form-field">
            <span>Name <em className="required">*</em></span>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </label>
          <label className="form-field">
            <span>Phone <em className="required">*</em></span>
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} pattern="[0-9]{10}" required />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </label>
          <label className="form-field">
            <span>Location</span>
            <input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Vadgam" />
          </label>
          <label className="form-field">
            <span>Pincode</span>
            <input type="text" value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} />
          </label>
          <label className="form-field">
            <span>Joining Date</span>
            <input type="date" value={form.joiningDate} onChange={(e) => setForm((f) => ({ ...f, joiningDate: e.target.value }))} />
          </label>
        </div>
      </div>

      {/* ── Collection Settings ── */}
      <div className="supplier-form-section">
        <p className="eyebrow">Collection Settings</p>
        <div className="form-grid">
          <div className="form-field full-span">
            <span>Sessions <em className="required">*</em></span>
            <div className="supplier-session-toggles">
              {["morning", "evening"].map((session) => (
                <label key={session} className="supplier-session-option">
                  <input type="checkbox" checked={form.collectionSessions.includes(session)} onChange={() => handleSessionToggle(session)} />
                  <span>{session}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="form-field">
            <span>Morning Qty (L)</span>
            <input type="number" min="0" step="0.1" value={form.defaultMorningQty} onChange={(e) => setForm((f) => ({ ...f, defaultMorningQty: e.target.value }))} placeholder="0" />
          </label>
          <label className="form-field">
            <span>Evening Qty (L)</span>
            <input type="number" min="0" step="0.1" value={form.defaultEveningQty} onChange={(e) => setForm((f) => ({ ...f, defaultEveningQty: e.target.value }))} placeholder="0" />
          </label>
          <label className="form-field">
            <span>Rate / Liter (₹)</span>
            <input type="number" min="0" step="0.01" value={form.defaultRatePerLiter} onChange={(e) => setForm((f) => ({ ...f, defaultRatePerLiter: e.target.value }))} placeholder="0.00" />
          </label>
        </div>
      </div>

      {/* ── Bank Details ── */}
      <div className="supplier-form-section">
        <p className="eyebrow">Bank Details</p>
        <div className="form-grid">
          <label className="form-field">
            <span>Account Holder</span>
            <input type="text" value={form.bankDetails.holderName} onChange={(e) => handleBankChange("holderName", e.target.value)} />
          </label>
          <label className="form-field">
            <span>Account Number</span>
            <input type="text" value={form.bankDetails.accountNo} onChange={(e) => handleBankChange("accountNo", e.target.value)} />
          </label>
          <label className="form-field">
            <span>IFSC Code</span>
            <input type="text" value={form.bankDetails.ifscCode} onChange={(e) => handleBankChange("ifscCode", e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" />
          </label>
          <label className="form-field">
            <span>Bank Name</span>
            <input type="text" value={form.bankDetails.bankName} onChange={(e) => handleBankChange("bankName", e.target.value)} />
          </label>
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="supplier-form-section">
        <label className="form-field">
          <span>Notes</span>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any additional notes..." />
        </label>
      </div>

      {/* ── Save Actions ── */}
      <div className="supplier-form-actions">
        <button className="primary-button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        {modalMode === "edit" && editingSupplier && (
          <div className="supplier-form-actions-row">
            <button
              className={`mini-button ${editingSupplier.isActive ? "warning" : "active"}`}
              onClick={() => { closeModal(); setConfirmAction({ type: "toggle", supplier: editingSupplier }); }}
            >
              {editingSupplier.isActive ? "Deactivate" : "Activate"}
            </button>
            <button
              className="mini-button danger"
              onClick={() => { closeModal(); setConfirmAction({ type: "delete", supplier: editingSupplier }); }}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const columns = useMemo(() => [
    {
      key: "name",
      label: "Farmer",
      sortable: true,
      render: (row) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <strong>{row.name}</strong>
          <span className="text-muted" style={{ fontSize: "0.85em" }}>{row.phone}</span>
        </div>
      ),
    },
    {
      key: "location",
      label: "Location",
      sortable: true,
      render: (row) => row.location
        ? <span>{row.location}{row.pincode ? ` - ${row.pincode}` : ""}</span>
        : <span className="text-muted" style={{ fontStyle: "italic" }}>—</span>,
    },
    {
      key: "defaultRatePerLiter",
      label: "Rate / L",
      sortable: true,
      render: (row) => <span>₹{Number(row.defaultRatePerLiter || 0).toFixed(2)}</span>,
    },
    {
      key: "outstandingAmount",
      label: "Outstanding",
      sortable: true,
      render: (row) => (
        <span style={{ color: row.outstandingAmount > 0 ? "var(--color-warning, #d97706)" : "inherit", fontWeight: row.outstandingAmount > 0 ? 600 : 400 }}>
          {formatCurrency(row.outstandingAmount)}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      sortable: false,
      render: (row) => row.isActive ? <StatusTag value="active" /> : <StatusTag value="inactive" />,
    },
    {
      key: "actions",
      label: "",
      sortable: false,
      render: (row) => (
        <div className="table-actions" onClick={(e) => e.stopPropagation()}>
          <button className="mini-button" onClick={() => openEdit(row)}>Edit</button>
        </div>
      ),
    },
  ], [openEdit]);

  const renderCard = useCallback((row) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          <span className="mc-name">{row.name}</span>
          <span className="mc-sub">{row.phone}{row.location ? ` · ${row.location}` : ""}</span>
        </div>
        <div className="supplier-card-actions">
          <StatusTag value={row.isActive ? "active" : "inactive"} />
          <button className="supplier-card-edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(row); }} aria-label="Edit">
            <Pencil size={14} />
          </button>
        </div>
      </div>
      <div className="mc-stats">
        <div className="mc-stat">
          <span className="mc-stat-label">Rate / L</span>
          <span className="mc-stat-value">₹{Number(row.defaultRatePerLiter || 0).toFixed(2)}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-label">Outstanding</span>
          <span className={`mc-stat-value ${row.outstandingAmount > 0 ? "danger" : "muted"}`}>
            {formatCurrency(row.outstandingAmount)}
          </span>
        </div>
      </div>
    </>
  ), [openEdit]);

  if (loading && suppliers.length === 0) return <LoadingScreen />;

  return (
    <div className="view-stack suppliers-page">
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length} farmer${suppliers.length !== 1 ? "s" : ""} in the system`}
        actions={
          <button className="primary-button" onClick={openCreate}>
            <Plus size={16} /> Add Farmer
          </button>
        }
      />

      <div className="surface">
        <div className="surface-filters">
          <div className="filter-tabs">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                className={`filter-tab ${statusFilter === f.id ? "active" : ""}`}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="search-input-wrap">
            <input
              type="text"
              className="search-input"
              placeholder="Search name, phone or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery("")} aria-label="Clear">&times;</button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          sortable
          defaultSortKey="name"
          defaultSortDir="asc"
          pageSize={20}
          searchQuery={searchQuery}
          searchKeys={["name", "phone", "location", "pincode"]}
          renderCard={renderCard}
          onRowClick={(row) => navigate(`/suppliers/${row._id}`)}
          emptyText="No suppliers found."
          emptyAction={
            <button className="primary-button" onClick={openCreate}>
              <Plus size={16} /> Add First Farmer
            </button>
          }
        />
      </div>

      {isMobile ? (
        <BottomSheet
          isOpen={modalMode !== null}
          onClose={closeModal}
          title={modalMode === "create" ? "Add Farmer / Supplier" : "Edit Supplier"}
        >
          {supplierFormContent}
        </BottomSheet>
      ) : (
        <Modal
          open={modalMode !== null}
          onClose={closeModal}
          title={modalMode === "create" ? "Add Farmer / Supplier" : "Edit Supplier"}
          footer={
            <div className="modal-actions">
              <button className="mini-button" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="primary-button" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
              {modalMode === "edit" && editingSupplier && (
                <>
                  <span className="modal-actions-sep" />
                  <button
                    className={`mini-button ${editingSupplier.isActive ? "warning" : "active"}`}
                    onClick={() => { closeModal(); setConfirmAction({ type: "toggle", supplier: editingSupplier }); }}
                  >
                    {editingSupplier.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="mini-button danger"
                    onClick={() => { closeModal(); setConfirmAction({ type: "delete", supplier: editingSupplier }); }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          }
        >
          {supplierFormContent}
        </Modal>
      )}

      {confirmAction?.type === "toggle" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={handleToggleStatus}
          title={confirmAction.supplier.isActive ? "Deactivate Supplier" : "Activate Supplier"}
          message={
            confirmAction.supplier.isActive
              ? `Deactivate ${confirmAction.supplier.name}? Their entries will no longer be generated in daily collections.`
              : `Activate ${confirmAction.supplier.name}? They will be included in future daily collection entries.`
          }
          confirmText={confirmAction.supplier.isActive ? "Deactivate" : "Activate"}
          variant={confirmAction.supplier.isActive ? "danger" : "active"}
        />
      )}

      {confirmAction?.type === "delete" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={handleDelete}
          title="Remove Supplier"
          message={`Remove ${confirmAction.supplier.name}? Their collection and payment history will be preserved but they will no longer appear in the active supplier list.`}
          confirmText="Remove"
          variant="danger"
        />
      )}
    </div>
  );
}
