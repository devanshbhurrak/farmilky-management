import { Loader2, RefreshCw } from "lucide-react";
import UserMenu from "./UserMenu";

export default function Topbar({ onRefresh, loading }) {
  return (
    <header className="site-topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <span className="brand-mark">Farmilky</span>
          <span className="topbar-caption">Dashboard</span>
        </div>
        <div className="topbar-right">
          <button
            className="mini-button refresh-button with-icon"
            type="button"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={16} className="spin-icon" aria-hidden />
            ) : (
              <RefreshCw size={16} aria-hidden />
            )}
            <span>{loading ? "Refreshing..." : "Refresh Data"}</span>
          </button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
