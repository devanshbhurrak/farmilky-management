import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, SlidersHorizontal } from "lucide-react";
import { formatCurrency } from "../utils/format";
import { usePaginatedFetch } from "../hooks/usePaginatedFetch";
import { apiRequest } from "../api/client";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import FilterSheet from "../components/ui/FilterSheet";
import RightDrawer from "../components/ui/RightDrawer";
import BottomSheet from "../components/ui/BottomSheet";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import StatusTag from "../components/ui/StatusTag";
import LoadingScreen from "../components/ui/LoadingScreen";
import PageError from "../components/ui/PageError";
import toast from "react-hot-toast";
import { useMediaQuery } from "../hooks/useMediaQuery";

const EMPTY_FORM = {
  name: "", phone: "", email: "", location: "", pincode: "",
  joiningDate: new Date().toISOString().split("T")[0],
  collectionSessions: ["morning", "evening"],
  defaultMorningQty: "", defaultEveningQty: "",
  defaultRatePerLiter: "",
  bankDetails: { accountNo: "", ifscCode: "", bankName: "", holderName: "" },
  notes: "",
};

const STATUS_ALL      = "all";
const OUTSTANDING_ALL = "all";

export default function SuppliersPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Client-side filters on fetched records
  const [statusFilter,      setStatusFilter]      = useState(STATUS_ALL);
  const [outstandingFilter, setOutstandingFilter] = useState(OUTSTANDING_ALL);
  const [filterOpen, setFilterOpen] = useState(false);

  const [modalMode,       setModalMode]       = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form,            setForm]            = useState({ ...EMPTY_FORM });
  const [saving,          setSaving]          = useState(false);
  const [confirmAction,   setConfirmAction]   = useState(null);
  const [confirmLoading,  setConfirmLoading]  = useState(false);

  const {
    data: suppliers,
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
  } = usePaginatedFetch("/api/suppliers", {
    initialLimit: 20,
    initialSort: { sortBy: "createdAt", sortOrder: "desc" },
    dataKey: "suppliers",
  });

  // Apply client-side filters on the current page's records
  const filteredSuppliers = useMemo(() => {
    let result = suppliers;
    if (statusFilter !== STATUS_ALL) {
      const want = statusFilter === "active";
      result = result.filter((s) => Boolean(s.isActive) === want);
    }
    if (outstandingFilter !== OUTSTANDING_ALL) {
      if (outstandingFilter === "due")   result = result.filter((s) => (s.outstandingAmount ?? 0) > 0);
      if (outstandingFilter === "clear") result = result.filter((s) => (s.outstandingAmount ?? 0) <= 0);
    }
    return result;
  }, [suppliers, statusFilter, outstandingFilter]);

  const activeFilterCount = [
    statusFilter      !== STATUS_ALL,
    outstandingFilter !== OUTSTANDING_ALL,
  ].filter(Boolean).length;

  function clearLocalFilters() {
    setStatusFilter(STATUS_ALL);
    setOutstandingFilter(OUTSTANDING_ALL);
  }

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
      defaultMorningQty:   supplier.defaultMorningQty?.toString()   || "",
      defaultEveningQty:   supplier.defaultEveningQty?.toString()   || "",
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
    if (!form.name || !form.phone) { toast.error("Name and phone are required."); return; }
    if (form.collectionSessions.length === 0) { toast.error("Select at least one collection session."); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, phone: form.phone, email: form.email,
        location: form.location, pincode: form.pincode,
        joiningDate: form.joiningDate || null,
        collectionSessions: form.collectionSessions,
        defaultMorningQty:   form.defaultMorningQty   ? parseFloat(form.defaultMorningQty)   : 0,
        defaultEveningQty:   form.defaultEveningQty   ? parseFloat(form.defaultEveningQty)   : 0,
        defaultRatePerLiter: form.defaultRatePerLiter ? parseFloat(form.defaultRatePerLiter) : 0,
        bankDetails: form.bankDetails,
        notes: form.notes,
      };
      const url    = modalMode === "create" ? "/api/suppliers" : `/api/suppliers/${editingSupplier._id}`;
      const method = modalMode === "create" ? "POST" : "PUT";
      const res    = await apiRequest(url, { method, body: JSON.stringify(payload) });
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
    if (!confirmAction || confirmAction.type !== "toggle" || confirmLoading) return;
    const supplier = confirmAction.supplier;
    setConfirmLoading(true);
    try {
      const res    = await apiRequest(`/api/suppliers/${supplier._id}/status`, {
        method: "PATCH", body: JSON.stringify({ isActive: !supplier.isActive }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success(result.message);
      setConfirmAction(null);
      refetch();
    } catch (err) { toast.error(err.message); }
    finally { setConfirmLoading(false); }
  }, [confirmAction, confirmLoading, refetch]);

  const handleDelete = useCallback(async () => {
    if (!confirmAction || confirmAction.type !== "delete" || confirmLoading) return;
    const supplier = confirmAction.supplier;
    setConfirmLoading(true);
    try {
      const res    = await apiRequest(`/api/suppliers/${supplier._id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success(result.message);
      setConfirmAction(null);
      refetch();
    } catch (err) { toast.error(err.message); }
    finally { setConfirmLoading(false); }
  }, [confirmAction, confirmLoading, refetch]);

  const supplierFormContent = (
    <div className="supplier-form">
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
            <input type="number" inputMode="decimal" min="0" step="0.1" value={form.defaultMorningQty} onChange={(e) => setForm((f) => ({ ...f, defaultMorningQty: e.target.value }))} placeholder="0" />
          </label>
          <label className="form-field">
            <span>Evening Qty (L)</span>
            <input type="number" inputMode="decimal" min="0" step="0.1" value={form.defaultEveningQty} onChange={(e) => setForm((f) => ({ ...f, defaultEveningQty: e.target.value }))} placeholder="0" />
          </label>
          <label className="form-field">
            <span>Rate / Liter (₹)</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={form.defaultRatePerLiter} onChange={(e) => setForm((f) => ({ ...f, defaultRatePerLiter: e.target.value }))} placeholder="0.00" />
          </label>
        </div>
      </div>

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

      <div className="supplier-form-section">
        <label className="form-field">
          <span>Notes</span>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any additional notes..." />
        </label>
      </div>

      {modalMode === "edit" && editingSupplier && (
        <div className="supp-edit-danger-row">
          <button
            className={`btn btn-sm ${editingSupplier.isActive ? "warning" : "active"}`}
            onClick={() => { closeModal(); setConfirmAction({ type: "toggle", supplier: editingSupplier }); }}
          >
            {editingSupplier.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            className="btn btn-sm danger"
            onClick={() => { closeModal(); setConfirmAction({ type: "delete", supplier: editingSupplier }); }}
          >
            Remove
          </button>
        </div>
      )}

    </div>
  );

  const columns = useMemo(() => [
    {
      key: "name", label: "Farmer", sortable: true,
      render: (row) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <strong>{row.name}</strong>
          <span className="text-muted" style={{ fontSize: "0.85em" }}>{row.phone}</span>
        </div>
      ),
    },
    {
      key: "location", label: "Location", sortable: true,
      render: (row) => row.location
        ? <span>{row.location}{row.pincode ? ` - ${row.pincode}` : ""}</span>
        : <span className="text-muted" style={{ fontStyle: "italic" }}>—</span>,
    },
    {
      key: "defaultRatePerLiter", label: "Rate / L", sortable: true,
      render: (row) => <span>₹{Number(row.defaultRatePerLiter || 0).toFixed(2)}</span>,
    },
    {
      key: "outstandingAmount", label: "Outstanding", sortable: true,
      render: (row) => (
        <span className={row.outstandingAmount > 0 ? "danger-text strong-text" : undefined}>
          {formatCurrency(row.outstandingAmount)}
        </span>
      ),
    },
    {
      key: "isActive", label: "Status", sortable: false,
      render: (row) => <StatusTag value={row.isActive ? "active" : "inactive"} />,
    },
    {
      key: "actions", label: "", sortable: false,
      render: (row) => (
        <div className="table-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm" onClick={() => openEdit(row)}>Edit</button>
        </div>
      ),
    },
  ], [openEdit]);

  const renderCard = useCallback((row) => {
    const initials = row.name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    const sessions = Array.isArray(row.collectionSessions) && row.collectionSessions.length > 0
      ? row.collectionSessions.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" & ")
      : "—";
    return (
      <>
        <div className={`supp-card-top ${row.isActive ? "supp-card-top--active" : "supp-card-top--inactive"}`}>
          <div className="supp-card-avatar">{initials}</div>
          <div className="supp-card-identity">
            <span className="supp-card-name">{row.name}</span>
            <span className="supp-card-sub">{row.phone}</span>
            {row.location && (
              <span className="supp-card-sub">{row.location}{row.pincode ? ` · ${row.pincode}` : ""}</span>
            )}
          </div>
          <div className="supp-card-meta">
            <StatusTag value={row.isActive ? "active" : "inactive"} />
            <button className="supplier-card-edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(row); }} aria-label="Edit">
              <Pencil size={14} />
            </button>
          </div>
        </div>
        <div className="supp-card-stats">
          <div className="supp-card-stat">
            <span className="supp-card-stat-label">Sessions</span>
            <span className="supp-card-stat-value">{sessions}</span>
          </div>
          <div className="supp-card-stat">
            <span className="supp-card-stat-label">Rate / L</span>
            <span className="supp-card-stat-value">₹{Number(row.defaultRatePerLiter || 0).toFixed(2)}</span>
          </div>
          <div className="supp-card-stat">
            <span className="supp-card-stat-label">Outstanding</span>
            <span className={`supp-card-stat-value ${row.outstandingAmount > 0 ? "supp-due" : "supp-clear"}`}>
              {formatCurrency(row.outstandingAmount)}
            </span>
          </div>
        </div>
      </>
    );
  }, [openEdit]);

  if (loading && suppliers.length === 0) return <LoadingScreen />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="view-stack suppliers-page">
      <PageHeader
        title="Suppliers"
        subtitle={`${pagination.total} farmer${pagination.total !== 1 ? "s" : ""} in the system`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> <span className="btn-label">Add Farmer</span>
          </button>
        }
      />

      <div className="surface">
        <div className="surface-filters">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or location..." />
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
          data={filteredSuppliers}
          loading={loading}
          sortable
          renderCard={renderCard}
          onRowClick={(row) => navigate(`/suppliers/${row._id}`)}
          emptyText={activeFilterCount > 0 ? "No suppliers match the selected filters." : "No suppliers found."}
          noMatchAction={activeFilterCount > 0 ? { label: "Clear filters", onClick: clearLocalFilters } : undefined}
          emptyAction={
            !activeFilterCount ? (
              <button className="btn btn-primary" onClick={openCreate}>
                <Plus size={16} /> Add First Farmer
              </button>
            ) : undefined
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
              { label: "All",      value: STATUS_ALL },
              { label: "Active",   value: "active"   },
              { label: "Inactive", value: "inactive" },
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
          <span className="cust-filter-label">Outstanding</span>
          <div className="cust-filter-options">
            {[
              { label: "All",              value: OUTSTANDING_ALL },
              { label: "Has Due",          value: "due"           },
              { label: "No Outstanding",   value: "clear"         },
            ].map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={`cust-filter-chip${outstandingFilter === value ? " active" : ""}`}
                onClick={() => setOutstandingFilter(value)}
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
              { label: "Newest",              sortBy: "createdAt",         sortOrder: "desc" },
              { label: "Oldest",              sortBy: "createdAt",         sortOrder: "asc"  },
              { label: "Name A–Z",            sortBy: "name",              sortOrder: "asc"  },
              { label: "Name Z–A",            sortBy: "name",              sortOrder: "desc" },
              { label: "Highest Outstanding", sortBy: "outstandingAmount", sortOrder: "desc" },
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

      {(() => {
        const modalFooter = (
          <div className="supp-edit-footer-primary">
            <button className="btn btn-sm" onClick={closeModal} disabled={saving}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        );
        return isMobile ? (
          <BottomSheet isOpen={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Farmer / Supplier" : "Edit Supplier"} footer={modalFooter}>
            {supplierFormContent}
          </BottomSheet>
        ) : (
          <RightDrawer open={modalMode !== null} onClose={closeModal} title={modalMode === "create" ? "Add Farmer / Supplier" : "Edit Supplier"} footer={modalFooter}>
            {supplierFormContent}
          </RightDrawer>
        );
      })()}

      {confirmAction?.type === "toggle" && (
        <ConfirmDialog
          open
          onClose={() => { if (!confirmLoading) setConfirmAction(null); }}
          onConfirm={handleToggleStatus}
          loading={confirmLoading}
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
          onClose={() => { if (!confirmLoading) setConfirmAction(null); }}
          onConfirm={handleDelete}
          loading={confirmLoading}
          title="Remove Supplier"
          message={`Remove ${confirmAction.supplier.name}? Their collection and payment history will be preserved but they will no longer appear in the active supplier list.`}
          confirmText="Remove"
          variant="danger"
        />
      )}
    </div>
  );
}
