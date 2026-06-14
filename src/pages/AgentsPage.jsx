import { useState, useMemo, useCallback } from "react";
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

const fetchAgents = createApiFetch("/api/agents");
const fetchAreas = createApiFetch("/api/areas");

const EMPTY_FORM = {
  name: "", email: "", phone: "", password: "",
  joiningDate: new Date().toISOString().split("T")[0],
  vehicleType: "", maxCapacity: "", assignedArea: "",
};

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "unassigned", label: "Unassigned" },
];

export default function AgentsPage() {
  const { data, loading, refetch } = useApiData(fetchAgents);
  const { data: areaData } = useApiData(fetchAreas);
  const agents = data?.users ?? [];
  const areas = areaData?.areas ?? [];

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const filtered = useMemo(() => {
    let result = agents;
    if (statusFilter === "active") result = result.filter((a) => a.isActive);
    if (statusFilter === "inactive") result = result.filter((a) => !a.isActive);
    if (statusFilter === "unassigned") result = result.filter((a) => !a.agentInfo?.assignedArea);
    return result;
  }, [agents, statusFilter]);

  const openCreate = useCallback(() => {
    setEditingAgent(null);
    setForm({ ...EMPTY_FORM });
    setModalMode("create");
  }, []);

  const openEdit = useCallback((agent) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name || "",
      email: agent.email || "",
      phone: agent.phone || "",
      password: "",
      joiningDate: agent.agentInfo?.joiningDate
        ? new Date(agent.agentInfo.joiningDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      vehicleType: agent.agentInfo?.vehicleType || "",
      maxCapacity: agent.agentInfo?.maxCapacity?.toString() || "",
      assignedArea: agent.agentInfo?.assignedArea?._id || agent.agentInfo?.assignedArea || "",
    });
    setModalMode("edit");
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingAgent(null);
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name || !form.email || !form.phone) {
      toast.error("Name, email, and phone are required.");
      return;
    }
    if (modalMode === "create" && !form.password) {
      toast.error("Password is required for new agents.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        ...(modalMode === "create" ? { password: form.password } : {}),
        agentInfo: {
          joiningDate: form.joiningDate ? new Date(form.joiningDate).toISOString() : null,
          vehicleType: form.vehicleType,
          maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity, 10) : 0,
          assignedArea: form.assignedArea || null,
        },
      };

      const url = modalMode === "create" ? "/api/agents" : `/api/agents/${editingAgent._id}`;
      const method = modalMode === "create" ? "POST" : "PUT";

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to save agent");

      toast.success(modalMode === "create" ? "Agent created." : "Agent updated.");
      closeModal();
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, modalMode, editingAgent, closeModal, refetch]);

  const handleToggleStatus = useCallback(async () => {
    if (!confirmAction || confirmAction.type !== "toggle") return;
    const agent = confirmAction.agent;
    try {
      const res = await apiRequest(`/api/agents/${agent._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !agent.isActive }),
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
    const agent = confirmAction.agent;
    try {
      const res = await apiRequest(`/api/agents/${agent._id}`, { method: "DELETE" });
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
      label: "Name",
      sortable: true,
      render: (row) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <strong>{row.name}</strong>
          <span className="text-muted" style={{ fontSize: "0.85em" }}>{row.email}</span>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      sortable: true,
    },
    {
      key: "isActive",
      label: "Status",
      sortable: false,
      render: (row) => row.isActive
        ? <StatusTag value="active" />
        : <StatusTag value="inactive" />,
    },
    {
      key: "agentInfo.assignedArea",
      label: "Area",
      sortable: false,
      render: (row) => {
        const areaName = row.agentInfo?.assignedArea?.name;
        return areaName
          ? <span>{areaName}</span>
          : <span className="text-muted" style={{ fontStyle: "italic" }}>Unassigned</span>;
      },
    },
    {
      key: "agentInfo.joiningDate",
      label: "Joined",
      sortable: true,
      render: (row) => {
        if (!row.agentInfo?.joiningDate) return <span className="text-muted">—</span>;
        return new Date(row.agentInfo.joiningDate).toLocaleDateString();
      },
    },
    {
      key: "actions",
      label: "",
      sortable: false,
      render: (row) => (
        <div className="table-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="mini-button"
            onClick={() => openEdit(row)}
          >
            Edit
          </button>
          <button
            className={`mini-button ${row.isActive ? "warning" : "active"}`}
            onClick={() => setConfirmAction({ type: "toggle", agent: row })}
          >
            {row.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            className="mini-button danger"
            onClick={() => setConfirmAction({ type: "delete", agent: row })}
          >
            Delete
          </button>
        </div>
      ),
    },
  ], [openEdit]);

  const renderCard = useCallback((row) => (
    <div className="agent-card-content">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>{row.name}</strong>
        {row.isActive ? <StatusTag value="active" /> : <StatusTag value="inactive" />}
      </div>
      <div className="text-muted" style={{ fontSize: "0.9em", marginBottom: 4 }}>
        {row.email} &middot; {row.phone}
      </div>
      <div style={{ fontSize: "0.85em" }}>
        Area: {row.agentInfo?.assignedArea?.name || <em style={{ color: "var(--text-muted)" }}>Unassigned</em>}
      </div>
    </div>
  ), []);

  if (loading && agents.length === 0) return <LoadingScreen />;

  return (
    <div className="view-stack agents-page">
      <PageHeader
        title="Delivery Agents"
        subtitle={`${agents.length} agent${agents.length !== 1 ? "s" : ""} in the system`}
        actions={
          <button className="primary-button" onClick={openCreate}>
            <Plus size={16} /> New Agent
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
              placeholder="Search name, email or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery("")} aria-label="Clear search">&times;</button>
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
          searchKeys={["name", "email", "phone"]}
          renderCard={renderCard}
          emptyText="No delivery agents found."
          emptyAction={
            <button className="primary-button" onClick={openCreate}>
              <Plus size={16} /> Add First Agent
            </button>
          }
        />
      </div>

      <Modal
        open={modalMode !== null}
        onClose={closeModal}
        title={modalMode === "create" ? "New Agent" : "Edit Agent"}
        footer={
          <div className="modal-actions">
            <button className="mini-button" onClick={closeModal} disabled={saving}>
              Cancel
            </button>
            <button className="mini-button active" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <label className="form-field">
            <span>Name <em className="required">*</em></span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Email <em className="required">*</em></span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleFormChange("email", e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Phone <em className="required">*</em></span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleFormChange("phone", e.target.value)}
              pattern="[0-9]{10}"
              required
            />
          </label>
          <label className="form-field">
            <span>Password {modalMode === "create" ? <em className="required">*</em> : "(leave blank to keep)"}</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => handleFormChange("password", e.target.value)}
              {...(modalMode === "create" ? { required: true } : {})}
            />
          </label>
          <label className="form-field">
            <span>Joining Date</span>
            <input
              type="date"
              value={form.joiningDate}
              onChange={(e) => handleFormChange("joiningDate", e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Vehicle Type</span>
            <input
              type="text"
              value={form.vehicleType}
              onChange={(e) => handleFormChange("vehicleType", e.target.value)}
              placeholder="e.g. Bike, Van"
            />
          </label>
          <label className="form-field">
            <span>Max Capacity</span>
            <input
              type="number"
              value={form.maxCapacity}
              onChange={(e) => handleFormChange("maxCapacity", e.target.value)}
              placeholder="Max items per trip"
            />
          </label>
          <label className="form-field">
            <span>Assigned Area</span>
            <select
              value={form.assignedArea}
              onChange={(e) => handleFormChange("assignedArea", e.target.value)}
            >
              <option value="">-- No Area --</option>
              {areas.map((a) => (
                <option key={a._id} value={a._id}>{a.name}</option>
              ))}
            </select>
          </label>
        </div>
      </Modal>

      {confirmAction?.type === "toggle" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={handleToggleStatus}
          title={confirmAction.agent.isActive ? "Deactivate Agent" : "Activate Agent"}
          message={
            confirmAction.agent.isActive
              ? `Deactivate ${confirmAction.agent.name}? They will be unassigned from their area and cannot access the delivery dashboard.`
              : `Activate ${confirmAction.agent.name}? They will regain access to the delivery dashboard.`
          }
          confirmText={confirmAction.agent.isActive ? "Deactivate" : "Activate"}
          variant={confirmAction.agent.isActive ? "danger" : "active"}
        />
      )}

      {confirmAction?.type === "delete" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={handleDelete}
          title="Delete Agent"
          message={`Delete ${confirmAction.agent.name}? The agent will be deactivated and unassigned from their area. This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}
