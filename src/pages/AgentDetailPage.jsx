import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { apiRequest, safeParseJson } from "../api/client";
import { formatDate } from "../utils/format";
import StatusTag from "../components/ui/StatusTag";
import PageHeader from "../components/ui/PageHeader";
import PageSkeleton from "../components/ui/PageSkeleton";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import toast from "react-hot-toast";

export default function AgentDetailPage() {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("activity");

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentRes, perfRes] = await Promise.all([
        apiRequest(`/api/user/admin/${id}`),
        apiRequest(`/api/agents/${id}/performance`),
      ]);
      if (!agentRes.ok) {
        const p = await safeParseJson(agentRes);
        throw new Error(p?.message || "Failed to load agent");
      }
      const agentData = await agentRes.json();
      setAgent(agentData.user || agentData);

      if (perfRes.ok) {
        const perfData = await perfRes.json();
        setPerformance(perfData.performance);
        setRecentActivity(perfData.recentActivity || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openEdit() {
    if (!agent) return;
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
    });
    setEditOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.email || !form.phone) {
      toast.error("Name, email, and phone are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        ...(form.password ? { password: form.password } : {}),
        agentInfo: {
          joiningDate: form.joiningDate ? new Date(form.joiningDate).toISOString() : null,
          vehicleType: form.vehicleType,
          maxCapacity: form.maxCapacity ? parseInt(form.maxCapacity, 10) : 0,
        },
      };
      const res = await apiRequest(`/api/agents/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to update");
      toast.success("Agent updated.");
      setEditOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!agent) return;
    try {
      const res = await apiRequest(`/api/agents/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success(result.message);
      setConfirmAction(null);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) return <PageSkeleton />;
  if (error) return <EmptyState text={error} action={{ label: "Retry", onClick: fetchData }} />;
  if (!agent) return <EmptyState text="Agent not found." />;

  const perf = performance || { totalDeliveries: 0, successfulDeliveries: 0, failedDeliveries: 0, skippedDeliveries: 0, successRate: 0, lastDeliveryDate: null };

  return (
    <div className="view-stack">
      <PageHeader
        title={agent.name}
        subtitle={`${agent.email} · ${agent.phone || "No phone"}`}
        breadcrumb={[
          { label: "Agents", path: "/agents" },
          { label: agent.name },
        ]}
        actions={
          <div className="detail-actions">
            <StatusTag value={agent.isActive ? "active" : "inactive"} />
            <div className="detail-actions-buttons">
              <button className="btn btn-secondary btn-sm" onClick={openEdit}>
                Edit
              </button>
              <button
                className={`btn btn-sm ${agent.isActive ? "btn-secondary" : "btn-primary"}`}
                onClick={() => setConfirmAction({ type: "toggle" })}
              >
                {agent.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        }
      />

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: "var(--space-1)" }}>Agent Since</p>
            <strong>{agent.agentInfo?.joiningDate ? formatDate(agent.agentInfo.joiningDate) : "—"}</strong>
          </div>
          <span style={{ background: "var(--surface-muted)", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-pill)", fontSize: "var(--font-size-xs)", fontWeight: "bold" }}>
            ID: #{agent._id?.slice(-6).toUpperCase()}
          </span>
        </div>

        <div style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--border-soft)", display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div>
            <p className="eyebrow">Assigned Area</p>
            <strong>{agent.agentInfo?.assignedArea?.name || <span style={{ fontStyle: "italic", color: "var(--text-muted)", fontWeight: "normal" }}>Not assigned</span>}</strong>
          </div>
          <div>
            <p className="eyebrow">Vehicle</p>
            <strong>{agent.agentInfo?.vehicleType || <span style={{ fontStyle: "italic", color: "var(--text-muted)", fontWeight: "normal" }}>None</span>}</strong>
          </div>
          <div>
            <p className="eyebrow">Max Capacity</p>
            <strong>{agent.agentInfo?.maxCapacity || <span style={{ fontStyle: "italic", color: "var(--text-muted)", fontWeight: "normal" }}>—</span>}</strong>
          </div>
          <div>
            <p className="eyebrow">Availability</p>
            <strong><StatusTag value={agent.agentInfo?.availability || "offline"} /></strong>
          </div>
        </div>
      </div>

      <div className="card-grid">
        <div className="panel info-card">
          <p className="eyebrow">Total Deliveries</p>
          <strong>{perf.totalDeliveries}</strong>
        </div>
        <div className="panel info-card">
          <p className="eyebrow">Success Rate</p>
          <strong style={{ color: perf.successRate >= 90 ? "var(--color-primary)" : perf.successRate >= 70 ? "var(--warning)" : "var(--danger)" }}>
            {perf.successRate}%
          </strong>
        </div>
        <div className="panel info-card">
          <p className="eyebrow">Failed</p>
          <strong style={{ color: "var(--danger)" }}>{perf.failedDeliveries}</strong>
        </div>
        <div className="panel info-card">
          <p className="eyebrow">Skipped</p>
          <strong>{perf.skippedDeliveries}</strong>
        </div>
      </div>

      <section className="panel">
        <div className="scrollable-tab-bar">
          {["activity", "info"].map((t) => (
            <button
              key={t}
              className={tab === t ? "tab-pill active" : "tab-pill"}
              onClick={() => setTab(t)}
            >
              {t === "activity" ? "Recent Activity" : "Agent Info"}
            </button>
          ))}
        </div>

        <div className="tab-content" style={{ marginTop: "1.5rem" }}>
          {tab === "activity" && (
            <div>
              {recentActivity.length === 0 ? (
                <EmptyState text="No recent delivery activity." />
              ) : (
                <div className="stack-list">
                  {recentActivity.map((manifest) => (
                    <div key={manifest._id} className="list-card">
                      <div>
                        <strong>{formatDate(manifest.date)}</strong>
                        <span>{manifest.summary?.total || 0} deliveries · {manifest.summary?.delivered || 0} completed</span>
                      </div>
                      <div className="card-figure">
                        <StatusTag value={manifest.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {perf.lastDeliveryDate && (
                <p className="text-muted" style={{ marginTop: "var(--space-3)", fontSize: "var(--font-size-xs)" }}>
                  Last delivery: {formatDate(perf.lastDeliveryDate)}
                </p>
              )}
            </div>
          )}

          {tab === "info" && (
            <div>
              <div className="stack-list">
                <div className="list-card">
                  <div><strong>Role</strong></div>
                  <div className="card-figure"><StatusTag value={agent.role} /></div>
                </div>
                <div className="list-card">
                  <div><strong>Email Verified</strong></div>
                  <div className="card-figure">{agent.isEmailVerified ? "Yes" : "No"}</div>
                </div>
                <div className="list-card">
                  <div><strong>Created</strong></div>
                  <div className="card-figure">{formatDate(agent.createdAt)}</div>
                </div>
                <div className="list-card">
                  <div><strong>Last Updated</strong></div>
                  <div className="card-figure">{formatDate(agent.updatedAt)}</div>
                </div>
                {agent.lastActiveAt && (
                  <div className="list-card">
                    <div><strong>Last Active</strong></div>
                    <div className="card-figure">{formatDate(agent.lastActiveAt)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Agent"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
            <button className="mini-button" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</button>
            <button className="mini-button active" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        }
      >
        {form && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Name <em style={{ color: "var(--danger)" }}>*</em></span>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Email <em style={{ color: "var(--danger)" }}>*</em></span>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Phone <em style={{ color: "var(--danger)" }}>*</em></span>
              <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Password (leave blank to keep)</span>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Joining Date</span>
              <input type="date" value={form.joiningDate} onChange={(e) => setForm((f) => ({ ...f, joiningDate: e.target.value }))} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Vehicle Type</span>
              <input type="text" value={form.vehicleType} onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))} placeholder="e.g. Bike, Van" />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>Max Capacity</span>
              <input type="number" value={form.maxCapacity} onChange={(e) => setForm((f) => ({ ...f, maxCapacity: e.target.value }))} placeholder="Max items per trip" />
            </label>
          </div>
        )}
      </Modal>

      {confirmAction && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={handleToggleStatus}
          title={agent.isActive ? "Deactivate Agent" : "Activate Agent"}
          message={
            agent.isActive
              ? `Deactivate ${agent.name}? They will be unassigned from their area and cannot access the delivery dashboard.`
              : `Activate ${agent.name}? They will regain access to the delivery dashboard.`
          }
          confirmText={agent.isActive ? "Deactivate" : "Activate"}
          variant={agent.isActive ? "danger" : "active"}
        />
      )}
    </div>
  );
}
