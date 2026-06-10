import { Loader2, RefreshCw } from "lucide-react";
import { formatTime } from "../../utils/format";
import UserMenu from "./UserMenu";

export default function Topbar({ lastUpdatedAt, onRefresh, loading }) {
  return (
    <header className="site-topbar">
      <div className="topbar-inner">
        <div className="topbar-right">
          <span className="updated-pill">
            Updated: {lastUpdatedAt ? formatTime(lastUpdatedAt) : "Not yet"}
          </span>
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
