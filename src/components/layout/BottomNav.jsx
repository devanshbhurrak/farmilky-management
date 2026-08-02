import { NavLink } from "react-router-dom";
import { LayoutDashboard, Truck, Droplets, MoreHorizontal, ClipboardList } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function BottomNav({ onMoreClick, isDrawerOpen = false }) {
  const { isAdmin } = useAuth();

  const linkClass = ({ isActive }) =>
    `nav-item ${isActive ? "active" : ""}`;

  const renderLink = ({ isActive }, label) => (
    <span aria-current={isActive ? "page" : undefined}>{label}</span>
  );

  if (!isAdmin) {
    return (
      <nav className="bottom-nav hide-desktop" aria-label="Primary">
        <div className="bottom-nav-inner delivery-nav-inner">
          <NavLink to="/agent" className={linkClass}>
            {({ isActive }) => (
              <>
                <ClipboardList size={24} aria-hidden />
                {renderLink({ isActive }, "Today")}
              </>
            )}
          </NavLink>
          <NavLink to="/deliveries" className={linkClass}>
            {({ isActive }) => (
              <>
                <Truck size={24} aria-hidden />
                {renderLink({ isActive }, "Deliveries")}
              </>
            )}
          </NavLink>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bottom-nav hide-desktop" aria-label="Primary">
      <div className="bottom-nav-inner">
        <NavLink to="/" className={linkClass} end>
          {({ isActive }) => (
            <>
              <LayoutDashboard size={24} aria-hidden />
              {renderLink({ isActive }, "Home")}
            </>
          )}
        </NavLink>
        <NavLink to="/deliveries" className={linkClass}>
          {({ isActive }) => (
            <>
              <Truck size={24} aria-hidden />
              {renderLink({ isActive }, "Deliveries")}
            </>
          )}
        </NavLink>
        <NavLink to="/milk-collections" className={linkClass}>
          {({ isActive }) => (
            <>
              <Droplets size={24} aria-hidden />
              {renderLink({ isActive }, "Collections")}
            </>
          )}
        </NavLink>
        <button
          type="button"
          className="nav-item"
          onClick={onMoreClick}
          aria-haspopup="dialog"
          aria-expanded={isDrawerOpen}
        >
          <MoreHorizontal size={24} aria-hidden />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
