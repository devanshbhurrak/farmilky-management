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
          <div className="card-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <div className="card-inset" style={{ textAlign: "center" }}>
               <Clock size={20} style={{ color: "var(--color-primary)", marginBottom: "var(--space-1)" }} />
               <span style={{ display: "block", fontSize: "10px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "2px" }}>PENDING</span>
               <strong style={{ fontSize: "var(--font-size-xl)" }}>{manifest.summary?.pending ?? 0}</strong>
            </div>
            <div className="card-inset" style={{ textAlign: "center" }}>
               <CheckCircle size={20} style={{ color: "var(--success-text)", marginBottom: "var(--space-1)" }} />
               <span style={{ display: "block", fontSize: "10px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "2px" }}>DELIVERED</span>
               <strong style={{ fontSize: "var(--font-size-xl)", color: "var(--color-primary)" }}>{manifest.summary?.delivered ?? 0}</strong>
            </div>
            <div className="card-inset" style={{ textAlign: "center" }}>
               <XCircle size={20} style={{ color: "var(--danger)", marginBottom: "var(--space-1)" }} />
               <span style={{ display: "block", fontSize: "10px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "2px" }}>FAILED</span>
               <strong style={{ fontSize: "var(--font-size-xl)", color: "var(--danger)" }}>{manifest.summary?.failed ?? 0}</strong>
            </div>
            <div className="card-inset" style={{ textAlign: "center" }}>
               <Truck size={20} style={{ color: "var(--text-muted)", marginBottom: "var(--space-1)" }} />
               <span style={{ display: "block", fontSize: "10px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "2px" }}>TOTAL</span>
               <strong style={{ fontSize: "var(--font-size-xl)" }}>{manifest.summary?.total ?? 0}</strong>
            </div>
          </div>

          <section className="panel" style={{ marginTop: "var(--space-4)" }}>
            <p className="eyebrow" style={{ marginBottom: "var(--space-4)" }}>Route Progress: {manifest.areaId?.name || "Unassigned Area"}</p>
            
            <div style={{ height: "12px", borderRadius: "var(--radius-pill)", background: "var(--surface-muted)", overflow: "hidden", marginBottom: "var(--space-2)" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-primary)", transition: "width 0.8s ease" }} />
            </div>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)", textAlign: "right", fontWeight: "bold" }}>{pct}% COMPLETE</p>
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

