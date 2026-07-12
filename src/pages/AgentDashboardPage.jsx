import { useNavigate } from "react-router-dom";
import { Truck, CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";
import { useApiData, createApiFetch } from "../hooks/useApiData";
import LoadingScreen from "../components/ui/LoadingScreen";
import EmptyState from "../components/ui/EmptyState";
import { formatDate } from "../utils/format";

const fetchMyManifest = createApiFetch("/api/manifests/my/today");

export default function AgentDashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useApiData(fetchMyManifest);
  const manifest = data?.manifest;

  if (loading) return <LoadingScreen />;

  const pct = manifest?.summary?.total
    ? Math.round(((manifest.summary.delivered + manifest.summary.failed) / manifest.summary.total) * 100)
    : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="view-stack" style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 className="page-header-title">{greeting}!</h1>
        <p className="page-header-subtitle">{formatDate(new Date())}</p>
      </div>

      {error || !manifest ? (
        <EmptyState 
          text="No deliveries assigned for today." 
          icon={Truck}
        />
      ) : (
        <div className="view-stack">
          <div className="metrics-grid">
            <div className="card-inset card-metric">
               <Clock size={20} className="agent-stat-icon agent-stat-icon--primary" />
               <span className="card-metric-label">PENDING</span>
               <strong className="card-metric-value">{manifest.summary?.pending ?? 0}</strong>
            </div>
            <div className="card-inset card-metric">
               <CheckCircle size={20} className="agent-stat-icon agent-stat-icon--success" />
               <span className="card-metric-label">DELIVERED</span>
               <strong className="card-metric-value" style={{ color: "var(--color-primary)" }}>{manifest.summary?.delivered ?? 0}</strong>
            </div>
            <div className="card-inset card-metric">
               <XCircle size={20} className="agent-stat-icon agent-stat-icon--danger" />
               <span className="card-metric-label">FAILED</span>
               <strong className="card-metric-value" style={{ color: "var(--danger)" }}>{manifest.summary?.failed ?? 0}</strong>
            </div>
            <div className="card-inset card-metric">
               <Truck size={20} className="agent-stat-icon" />
               <span className="card-metric-label">TOTAL</span>
               <strong className="card-metric-value">{manifest.summary?.total ?? 0}</strong>
            </div>
          </div>

          <section className="panel agent-progress-panel">
            <p className="eyebrow">Route Progress: {manifest.areaId?.name || "Unassigned Area"}</p>

            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="progress-label">{pct}% COMPLETE</p>
          </section>

          <button
            className="primary-button"
            style={{ width: "100%", height: "64px", fontSize: "1.2rem", marginTop: "var(--space-4)", borderRadius: "var(--radius)" }}
            onClick={() => navigate(`/agent/manifest/${manifest._id}`)}
          >
            <span>Start Deliveries</span>
            <ArrowRight size={24} />
          </button>
        </div>
      )}
    </div>
  );
}

