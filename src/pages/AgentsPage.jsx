import { useState, useMemo } from "react";
import { User, MapPin } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import LoadingScreen from "../components/ui/LoadingScreen";
import StatusTag from "../components/ui/StatusTag";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import toast from "react-hot-toast";

const fetchAgents = createApiFetch("/api/areas/agents");
const fetchAreas = createApiFetch("/api/areas");

export default function AgentsPage() {
  const { data: agentData, loading: agentLoading, refetch: refetchAgents } = useApiData(fetchAgents);
  const { data: areaData, loading: areaLoading } = useApiData(fetchAreas);
  const agents = agentData?.agents ?? [];
  const areas = areaData?.areas ?? [];

  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState({});

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const handleAssign = async (agentId, areaId) => {
    setAssigning((p) => ({ ...p, [agentId]: true }));
    try {
      const url = areaId ? `/api/areas/${areaId}` : null;
      if (!url) return;
      const res = await apiRequest(url, {
        method: "PUT",
        body: JSON.stringify({ assignedAgent: agentId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message);
      toast.success("Agent assigned.");
      refetchAgents();
    } catch (err) {
      toast.error(err.message || "Failed to assign agent.");
    } finally {
      setAssigning((p) => ({ ...p, [agentId]: false }));
    }
  };

  if (agentLoading || areaLoading) return <LoadingScreen />;

  return (
    <div className="view-stack agents-page">
      <PageHeader
        title="Delivery Agents"
        subtitle={`${agents.length} agent${agents.length !== 1 ? "s" : ""} registered in the system`}
      />

      <div className="surface">
        <div className="surface-filters">
          <input
            type="text"
            className="search-input"
            placeholder="Search name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="agents-empty-wrap">
            <EmptyState text="No delivery agents found." icon={User} />
          </div>
        ) : (
          <div className="agents-list">
            {filtered.map((agent) => (
              <div key={agent._id} className="agent-card">
                <div className="agent-card-info">
                  <div className="agent-card-name-row">
                    <strong className="agent-card-name">{agent.name}</strong>
                    <StatusTag value={agent.role} />
                  </div>
                  <p className="agent-card-contact">{agent.phone || agent.email}</p>
                  <div className="agent-card-area-row">
                    <MapPin size={13} />
                    {agent.assignedArea?.name ? (
                      <span>{agent.assignedArea.name}</span>
                    ) : (
                      <em>No area assigned</em>
                    )}
                  </div>
                </div>
                <div className="agent-area-select-wrap">
                  <select
                    value={agent.assignedArea?._id || ""}
                    onChange={(e) => handleAssign(agent._id, e.target.value)}
                    disabled={assigning[agent._id]}
                  >
                    <option value="">-- No Area --</option>
                    {areas.map((a) => (
                      <option key={a._id} value={a._id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
