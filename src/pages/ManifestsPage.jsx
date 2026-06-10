import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, RefreshCw, Play } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import { apiRequest } from "../api/client";
import { formatDate } from "../utils/format";
import LoadingScreen from "../components/ui/LoadingScreen";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import StatusTag from "../components/ui/StatusTag";
import toast from "react-hot-toast";

const todayStr = () => new Date().toISOString().split("T")[0];

const fetchManifests = createApiFetch("/api/manifests");

export default function ManifestsPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayStr());
  const { data, loading, error, refetch } = useApiData(() => fetchManifests({ date }), true);
  const manifests = data?.manifests ?? [];
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await apiRequest("/api/manifests/generate", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message);
      toast.success(payload.message);
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to generate manifests.");
    } finally {
      setGenerating(false);
    }
  };

  const completionPct = (m) => {
    if (!m.summary?.total) return 0;
    return Math.round(((m.summary.delivered + m.summary.failed) / m.summary.total) * 100);
  };

  if (loading && manifests.length === 0) return <LoadingScreen />;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="view-stack manifests-page">
      <PageHeader
        title="Delivery Manifests"
        subtitle={`Route sheets for ${formatDate(date)}`}
        actions={
          <div className="manifest-header-actions">
            <button className="btn btn-secondary btn-sm" onClick={refetch} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={generating}>
              <Play size={16} />
              {generating ? "Generating..." : "Generate Sheets"}
            </button>
          </div>
        }
      />

      <div className="surface">
        <div className="surface-filters">
          <div className="desktop-filters manifest-filter-row">
            <span className="manifest-date-label">Route Date:</span>
            <input
              type="date"
              className="manifest-date-input"
              value={date}
              onChange={(e) => { setDate(e.target.value); refetch(); }}
            />
          </div>
        </div>

        {manifests.length === 0 ? (
          <div className="manifest-empty-wrap">
            <EmptyState
              text={`No manifests found for ${formatDate(date)}.`}
              icon={ClipboardList}
              action={{ label: "Generate Manifests", onClick: handleGenerate }}
            />
          </div>
        ) : (
          <div className="manifest-cards-grid">
            {manifests.map((m) => {
              const pct = completionPct(m);
              return (
                <div
                  key={m._id}
                  className="manifest-card"
                  onClick={() => navigate(`/manifests/${m._id}`)}
                >
                  <div className="manifest-card-head">
                    <div className="manifest-card-identity">
                      <h3 className="manifest-card-agent">{m.agentId?.name || "Unknown Agent"}</h3>
                      <p className="manifest-card-area">{m.areaId?.name || "Unassigned Area"}</p>
                    </div>
                    <StatusTag value={m.status === "completed" ? "delivered" : m.status === "active" ? "active" : "paused"} />
                  </div>

                  <div className="manifest-card-stats">
                    <div className="manifest-card-stat">
                      <span>Total</span>
                      <strong>{m.summary?.total ?? 0}</strong>
                    </div>
                    <div className="manifest-card-stat done">
                      <span>Done</span>
                      <strong>{m.summary?.delivered ?? 0}</strong>
                    </div>
                    <div className="manifest-card-stat fail">
                      <span>Fail</span>
                      <strong>{m.summary?.failed ?? 0}</strong>
                    </div>
                  </div>

                  <div>
                    <div className="manifest-card-track">
                      <div className="manifest-card-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="manifest-card-pct">{pct}% complete</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
