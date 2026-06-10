import { RefreshCw, Loader2 } from "lucide-react";
import UserMenu from "./UserMenu";

export default function MobileHeader({ onRefresh, loading }) {
  return (
    <header className="mobile-header hide-desktop">
      <div className="mobile-header-inner">
        <div className="mobile-header-left">
          <h1 className="brand-mark">Farmilky</h1>
        </div>
        <div className="mobile-header-right">
          <button
            className="mobile-refresh-button"
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh data"
          >
            {loading ? (
              <Loader2 size={20} className="spin-icon" />
            ) : (
              <RefreshCw size={20} />
            )}
          </button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
