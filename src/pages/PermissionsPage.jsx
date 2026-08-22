import { useState, useCallback, useMemo, useEffect } from "react";
import { ShieldCheck, RotateCcw, Save, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "../api/client";
import PageHeader from "../components/ui/PageHeader";
import LoadingScreen from "../components/ui/LoadingScreen";
import PageError from "../components/ui/PageError";
import toast from "react-hot-toast";

// ─── Helpers ────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  agent: "Agent",
  delivery: "Delivery",
  delivery_partner: "Delivery Partner",
};

// Group registry items by their "group" field
function groupRegistry(registry) {
  const groups = {};
  for (const item of registry) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }
  return groups;
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, id }) {
  return (
    <label className="perm-toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="perm-toggle-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="perm-toggle-track">
        <span className="perm-toggle-thumb" />
      </span>
    </label>
  );
}

// ─── Role Permission Card ─────────────────────────────────────────────────────

function RoleCard({ role, roleData, registry, onSave, onReset }) {
  const [localPerms, setLocalPerms] = useState(() => new Set(roleData?.permissions ?? []));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => new Set(Object.keys(groupRegistry(registry))));

  // Sync when roleData changes (e.g. after reset)
  useEffect(() => {
    setLocalPerms(new Set(roleData?.permissions ?? []));
  }, [roleData]);

  const groups = useMemo(() => groupRegistry(registry), [registry]);

  const togglePerm = useCallback((key, enabled) => {
    setLocalPerms((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(key); else next.delete(key);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((group) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  }, []);

  const enableAll = useCallback((groupItems) => {
    setLocalPerms((prev) => {
      const next = new Set(prev);
      for (const item of groupItems) next.add(item.key);
      return next;
    });
  }, []);

  const disableAll = useCallback((groupItems) => {
    setLocalPerms((prev) => {
      const next = new Set(prev);
      for (const item of groupItems) next.delete(item.key);
      return next;
    });
  }, []);

  const isDirty = useMemo(() => {
    const original = new Set(roleData?.permissions ?? []);
    if (original.size !== localPerms.size) return true;
    for (const p of localPerms) {
      if (!original.has(p)) return true;
    }
    return false;
  }, [localPerms, roleData?.permissions]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(role, [...localPerms]);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await onReset(role);
    } finally {
      setResetting(false);
    }
  }

  const enabledCount = localPerms.size;
  const totalCount = registry.length;

  return (
    <div className="perm-role-card">
      <div className="perm-role-header">
        <div className="perm-role-title-row">
          <h2 className="perm-role-name">{ROLE_LABELS[role] ?? role}</h2>
          <span className="perm-role-badge">
            {enabledCount} / {totalCount} enabled
          </span>
        </div>
        {roleData?.updatedBy?.name && (
          <p className="perm-role-meta">
            Last updated by {roleData.updatedBy.name}
          </p>
        )}
      </div>

      <div className="perm-groups">
        {Object.entries(groups).map(([group, items]) => {
          const isOpen = openGroups.has(group);
          const enabledInGroup = items.filter((i) => localPerms.has(i.key)).length;

          return (
            <div key={group} className="perm-group">
              <button
                type="button"
                className="perm-group-header"
                onClick={() => toggleGroup(group)}
                aria-expanded={isOpen}
              >
                <span className="perm-group-name">{group}</span>
                <span className="perm-group-count">{enabledInGroup}/{items.length}</span>
                <span className="perm-group-bulk">
                  <button
                    type="button"
                    className="perm-bulk-btn"
                    onClick={(e) => { e.stopPropagation(); enableAll(items); }}
                    title="Enable all in group"
                  >All</button>
                  <button
                    type="button"
                    className="perm-bulk-btn perm-bulk-btn--off"
                    onClick={(e) => { e.stopPropagation(); disableAll(items); }}
                    title="Disable all in group"
                  >None</button>
                </span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isOpen && (
                <div className="perm-group-items">
                  {items.map((item) => (
                    <div key={item.key} className="perm-item">
                      <label className="perm-item-label" htmlFor={`${role}-${item.key}`}>
                        <span className="perm-item-text">{item.label}</span>
                        <span className="perm-item-key">{item.key}</span>
                      </label>
                      <ToggleSwitch
                        id={`${role}-${item.key}`}
                        checked={localPerms.has(item.key)}
                        onChange={(val) => togglePerm(item.key, val)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="perm-role-actions">
        <button
          type="button"
          className="mini-button"
          onClick={handleReset}
          disabled={resetting || saving}
          title="Reset to system defaults"
        >
          <RotateCcw size={14} />
          {resetting ? "Resetting…" : "Reset to Defaults"}
        </button>
        <button
          type="button"
          className={`btn ${isDirty ? "btn-primary" : "btn-secondary"}`}
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registry, setRegistry] = useState([]);
  const [roleMap, setRoleMap] = useState({}); // role → roleData

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [regRes, rolesRes] = await Promise.all([
        apiRequest("/api/permissions/registry"),
        apiRequest("/api/permissions/roles"),
      ]);
      const [regData, rolesData] = await Promise.all([regRes.json(), rolesRes.json()]);
      if (!regRes.ok) throw new Error(regData.message);
      if (!rolesRes.ok) throw new Error(rolesData.message);

      setRegistry(regData.registry ?? []);
      const map = {};
      for (const r of rolesData.roles ?? []) map[r.role] = r;
      setRoleMap(map);
    } catch (err) {
      setError(err.message || "Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async (role, permissions) => {
    const res = await apiRequest(`/api/permissions/roles/${role}`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    toast.success(`"${ROLE_LABELS[role] ?? role}" permissions saved.`);
    setRoleMap((prev) => ({ ...prev, [role]: data.role }));
  }, []);

  const handleReset = useCallback(async (role) => {
    const res = await apiRequest(`/api/permissions/roles/${role}/reset`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    toast.success(`"${ROLE_LABELS[role] ?? role}" reset to defaults.`);
    setRoleMap((prev) => ({ ...prev, [role]: data.role }));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <PageError message={error} onRetry={load} />;

  const roles = ["agent", "delivery", "delivery_partner"];

  return (
    <div className="view-stack perm-page">
      <PageHeader
        title="Permissions"
        subtitle="Control what each delivery role can see and do in the portal"
        icon={<ShieldCheck size={20} />}
      />

      <div className="perm-info-banner">
        <ShieldCheck size={16} />
        <span>
          Changes take effect within 60 seconds. Admins always have full access regardless of these settings.
        </span>
      </div>

      <div className="perm-roles-grid">
        {roles.map((role) => (
          <RoleCard
            key={role}
            role={role}
            roleData={roleMap[role]}
            registry={registry}
            onSave={handleSave}
            onReset={handleReset}
          />
        ))}
      </div>
    </div>
  );
}
