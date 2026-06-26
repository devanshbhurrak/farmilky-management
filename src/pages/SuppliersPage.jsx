import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import StatusTag from "../components/ui/StatusTag";
import LoadingScreen from "../components/ui/LoadingScreen";
import toast from "react-hot-toast";

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
          <button
            className={`mini-button ${row.isActive ? "warning" : "active"}`}
            onClick={() => setConfirmAction({ type: "toggle", supplier: row })}
          >
            {row.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            className="mini-button danger"
            onClick={() => setConfirmAction({ type: "delete", supplier: row })}
          >
            Remove
          </button>
        </div>
      ),
    },
  ], [openEdit]);

  const renderCard = useCallback((row) => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong>{row.name}</strong>
        {row.isActive ? <StatusTag value="active" /> : <StatusTag value="inactive" />}
      </div>
      <div className="text-muted" style={{ fontSize: "0.9em", marginBottom: 4 }}>
        {row.phone}{row.location ? ` · ${row.location}` : ""}
      </div>
      <div style={{ fontSize: "0.85em", display: "flex", gap: 12 }}>
        <span>Rate: ₹{Number(row.defaultRatePerLiter || 0).toFixed(2)}/L</span>
        {row.outstandingAmount > 0 && (
          <span style={{ color: "var(--color-warning, #d97706)", fontWeight: 600 }}>
            Due: {formatCurrency(row.outstandingAmount)}
          </span>
        )}
      </div>
    </div>
  ), []);

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

      <Modal
        open={modalMode !== null}
        onClose={closeModal}
        title={modalMode === "create" ? "Add Farmer / Supplier" : "Edit Supplier"}
        footer={
          <div className="modal-actions">
            <button className="mini-button" onClick={closeModal} disabled={saving}>Cancel</button>
            <button className="mini-button active" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          {/* Basic Info */}
          <label className="form-field">
            <span>Name <em className="required">*</em></span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="form-field">
            <span>Phone <em className="required">*</em></span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              pattern="[0-9]{10}"
              required
            />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Location (Village / Town)</span>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Vadgam"
            />
          </label>
          <label className="form-field">
            <span>Pincode</span>
            <input
              type="text"
              value={form.pincode}
              onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Joining Date</span>
            <input
              type="date"
              value={form.joiningDate}
              onChange={(e) => setForm((f) => ({ ...f, joiningDate: e.target.value }))}
            />
          </label>

          {/* Collection Settings */}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <span>Collection Sessions <em className="required">*</em></span>
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              {["morning", "evening"].map((session) => (
                <label key={session} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.collectionSessions.includes(session)}
                    onChange={() => handleSessionToggle(session)}
                  />
                  <span style={{ textTransform: "capitalize" }}>{session}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="form-field">
            <span>Default Morning Qty (L)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.defaultMorningQty}
              onChange={(e) => setForm((f) => ({ ...f, defaultMorningQty: e.target.value }))}
              placeholder="0"
            />
          </label>
          <label className="form-field">
            <span>Default Evening Qty (L)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.defaultEveningQty}
              onChange={(e) => setForm((f) => ({ ...f, defaultEveningQty: e.target.value }))}
              placeholder="0"
            />
          </label>
          <label className="form-field">
            <span>Default Rate / Liter (₹)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.defaultRatePerLiter}
              onChange={(e) => setForm((f) => ({ ...f, defaultRatePerLiter: e.target.value }))}
              placeholder="0.00"
            />
          </label>

          {/* Bank Details */}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <span style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: "0.85em", color: "var(--text-muted, #888)" }}>
              BANK DETAILS
            </span>
          </div>
          <label className="form-field">
            <span>Account Holder Name</span>
            <input
              type="text"
              value={form.bankDetails.holderName}
              onChange={(e) => handleBankChange("holderName", e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Account Number</span>
            <input
              type="text"
              value={form.bankDetails.accountNo}
              onChange={(e) => handleBankChange("accountNo", e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>IFSC Code</span>
            <input
              type="text"
              value={form.bankDetails.ifscCode}
              onChange={(e) => handleBankChange("ifscCode", e.target.value.toUpperCase())}
              placeholder="e.g. SBIN0001234"
            />
          </label>
          <label className="form-field">
            <span>Bank Name</span>
            <input
              type="text"
              value={form.bankDetails.bankName}
              onChange={(e) => handleBankChange("bankName", e.target.value)}
            />
          </label>

          {/* Notes */}
          <label className="form-field" style={{ gridColumn: "1 / -1" }}>
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Any additional notes..."
            />
          </label>
        </div>
      </Modal>

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
