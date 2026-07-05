import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import LoadingScreen from "../components/ui/LoadingScreen";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import DataTable from "../components/ui/DataTable";
import Modal from "../components/ui/Modal";
import BottomSheet from "../components/ui/BottomSheet";
import StatusTag from "../components/ui/StatusTag";
import toast from "react-hot-toast";
import { useMediaQuery } from "../hooks/useMediaQuery";

const currentYear = new Date().getFullYear();
const fetchHolidays = createApiFetch("/api/holidays");

export default function HolidaysPage() {
  const [year, setYear] = useState(currentYear);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { data, loading, error, refetch } = useApiData(() => fetchHolidays({ year }), true);
  const holidays = data?.holidays ?? [];

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: "", name: "" });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!form.date || !form.name.trim()) return toast.error("Date and name are required.");
    setSaving(true);
    try {
      const res = await apiRequest("/api/holidays", {
        method: "POST",
        body: JSON.stringify({ date: form.date, name: form.name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Holiday added.");
      setShowModal(false);
      setForm({ date: "", name: "" });
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to add holiday.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    setDeleting(true);
    try {
      const res = await apiRequest(`/api/holidays/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Holiday removed.");
      setDeleteConfirm(null);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to remove holiday.");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (holiday) => {
    try {
      const res = await apiRequest(`/api/holidays/${holiday._id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !holiday.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Holiday ${holiday.isActive ? "deactivated" : "activated"}.`);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to update holiday.");
    }
  };

  const columns = [
    {
      key: "date",
      label: "Date",
      render: (r) => (
        <strong>
          {new Date(r.date).toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </strong>
      ),
    },
    { key: "name", label: "Holiday Name" },
    {
      key: "isActive",
      label: "Status",
      render: (r) => <StatusTag value={r.isActive ? "active" : "paused"} />,
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (r) => (
        <div className="holidays-actions-cell">
          <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(r)}>
            {r.isActive ? "Deactivate" : "Activate"}
          </button>
          <button className="icon-button danger" onClick={() => setDeleteConfirm(r)} title="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  const renderHolidayCard = (h) => (
    <>
      <div className="mc-head">
        <div className="mc-identity">
          <span className="mc-name">{h.name}</span>
          <span className="mc-sub">
            {new Date(h.date).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        <StatusTag value={h.isActive ? "active" : "paused"} />
      </div>
      <div className="holidays-card-actions">
        <button className="btn btn-secondary btn-sm holidays-card-toggle" onClick={() => handleToggle(h)}>
          {h.isActive ? "Deactivate" : "Activate"}
        </button>
        <button className="btn btn-secondary btn-sm danger holidays-card-delete" onClick={() => setDeleteConfirm(h)}>
          <Trash2 size={16} />
        </button>
      </div>
    </>
  );

  if (loading) return <LoadingScreen />;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="view-stack holidays-page">
      <PageHeader
        title="Holidays"
        subtitle="Manage scheduled off-days for delivery services"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Add Holiday
          </button>
        }
      />

      <div className="surface">
        <div className="surface-filters">
          <div className="desktop-filters support-filter-row">
            <span className="support-filter-label">Year:</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="holidays-year-select"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={holidays}
          renderCard={renderHolidayCard}
          emptyText={`No holidays configured for ${year}.`}
        />
      </div>

      {isMobile ? (
        <BottomSheet isOpen={showModal} onClose={() => setShowModal(false)} title="Add Holiday">
          <div className="support-form-stack">
            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Holiday Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Republic Day"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? "Adding..." : "Add Holiday"}
              </button>
            </div>
          </div>
        </BottomSheet>
      ) : (
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title="Add Holiday"
          footer={
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? "Adding..." : "Add Holiday"}
              </button>
            </>
          }
        >
          <div className="support-form-stack">
            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Holiday Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Republic Day"
              />
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm?._id)}
        title="Remove Holiday"
        message={`Remove "${deleteConfirm?.name}" from the holiday calendar?`}
        confirmText="Remove Holiday"
        loading={deleting}
      />
    </div>
  );
}
