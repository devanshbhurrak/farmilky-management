import { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, MapPin, User } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import LoadingScreen from "../components/ui/LoadingScreen";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import StatusTag from "../components/ui/StatusTag";
import toast from "react-hot-toast";

const fetchAreas = createApiFetch("/api/areas");
const fetchAgents = createApiFetch("/api/areas/agents");

const EMPTY_FORM = { name: "", pincodes: "", localities: "", assignedAgent: "" };

export default function AreasPage() {
  const { data: areaData, loading, error, refetch } = useApiData(fetchAreas);
  const { data: agentData } = useApiData(fetchAgents);
  const areas = areaData?.areas ?? [];
  const agents = agentData?.agents ?? [];

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return areas;
    const q = search.toLowerCase();
    return areas.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.pincodes.some((p) => p.includes(q)) ||
        a.localities.some((l) => l.toLowerCase().includes(q))
    );
  }, [areas, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (area) => {
    setEditing(area);
    setForm({
      name: area.name,
      pincodes: area.pincodes.join(", "),
      localities: area.localities.join(", "),
      assignedAgent: area.assignedAgent?._id || "",
    });
    setShowModal(true);
  };

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Area name is required.");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        pincodes: form.pincodes.split(",").map((s) => s.trim()).filter(Boolean),
        localities: form.localities.split(",").map((s) => s.trim()).filter(Boolean),
        assignedAgent: form.assignedAgent || null,
      };
      const url = editing ? `/api/areas/${editing._id}` : "/api/areas";
      const method = editing ? "PUT" : "POST";
      const res = await apiRequest(url, { method, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(editing ? "Area updated." : "Area created.");
      setShowModal(false);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to save area.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (area) => {
    if (!area) return;
    setDeleting(true);
    try {
      const res = await apiRequest(`/api/areas/${area._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Area deleted.");
      setDeleteConfirm(null);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to delete area.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="view-stack areas-page">
      <PageHeader
        title="Delivery Areas"
        subtitle={`${areas.length} area${areas.length !== 1 ? "s" : ""} configured for operations`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} />
            New Area
          </button>
        }
      />

      <div className="surface">
        <div className="surface-filters">
          <div className="search-input-wrap">
            <input
              type="text"
              className="search-input"
              placeholder="Search by area name, pincode, or locality..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch("")} aria-label="Clear search">&times;</button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="areas-empty-wrap">
            <EmptyState
              text={search ? "No matching areas found." : "No areas configured yet."}
              icon={MapPin}
              action={!search ? { label: "Add First Area", onClick: openCreate } : undefined}
            />
          </div>
        ) : (
          <div className="areas-card-grid">
            {filtered.map((area) => (
              <div key={area._id} className="area-card">
                <div className="area-card-head">
                  <div className="area-card-title-block">
                    <h3 className="area-card-name">{area.name}</h3>
                    <StatusTag value={area.isActive ? "active" : "cancelled"} />
                  </div>
                  <div className="area-card-actions">
                    <button className="icon-button" onClick={() => openEdit(area)} title="Edit area">
                      <Edit2 size={15} />
                    </button>
                    <button className="icon-button danger" onClick={() => setDeleteConfirm(area)} title="Delete area">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="area-card-body">
                  {area.pincodes.length > 0 && (
                    <p><strong>Pincodes:</strong> {area.pincodes.join(", ")}</p>
                  )}
                  {area.localities.length > 0 && (
                    <p><strong>Localities:</strong> {area.localities.join(", ")}</p>
                  )}
                </div>

                <div className="area-card-agent">
                  <User size={14} className="area-card-agent-icon" />
                  {area.assignedAgent ? (
                    <span className="area-card-agent-name">{area.assignedAgent.name}</span>
                  ) : (
                    <em>No agent assigned</em>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Area" : "Create Area"}
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Area"}
            </button>
          </>
        }
      >
        <div className="area-form-stack">
          <div className="form-group">
            <label>Area Name *</label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Koramangala" />
          </div>
          <div className="form-group">
            <label>Pincodes (comma-separated)</label>
            <input name="pincodes" value={form.pincodes} onChange={handleChange} placeholder="560034, 560095" />
          </div>
          <div className="form-group">
            <label>Localities (comma-separated)</label>
            <input name="localities" value={form.localities} onChange={handleChange} placeholder="Block 1, Sector A" />
          </div>
          <div className="form-group">
            <label>Assign Agent</label>
            <select name="assignedAgent" value={form.assignedAgent} onChange={handleChange}>
              <option value="">-- No Agent --</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id}>{a.name} ({a.phone || a.email})</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm)}
        title="Delete Area"
        message={`Delete area "${deleteConfirm?.name}"? This will also clear its assigned agent.`}
        confirmText="Delete Area"
        loading={deleting}
      />
    </div>
  );
}
