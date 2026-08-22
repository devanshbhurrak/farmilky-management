import { NavLink } from "react-router-dom";
import { LayoutDashboard, Truck, Droplets, MoreHorizontal } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { deliveryNavItems } from "../../utils/constants";
import NavIcon from "../icons/NavIcon";

export default function BottomNav({ onMoreClick, isDrawerOpen = false }) {
  const { isAdmin, hasPermission } = useAuth();

  const linkClass = ({ isActive }) => `nav-item ${isActive ? "active" : ""}`;

  if (!isAdmin) {
    // Show up to 4 permission-filtered agent nav items in the bottom bar
    const agentItems = deliveryNavItems.filter(
      (item) => !item.permission || hasPermission(item.permission)
    );

    return (
      <nav className="bottom-nav hide-desktop" aria-label="Primary">
        <div className="bottom-nav-inner delivery-nav-inner">
          {agentItems.map((item) => (
            <NavLink key={item.id} to={item.path} className={linkClass}>
              {({ isActive }) => (
                <>
                  <NavIcon name={item.icon} size={24} />
                  <span aria-current={isActive ? "page" : undefined}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
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
              <span aria-current={isActive ? "page" : undefined}>Home</span>
            </>
          )}
        </NavLink>
        <NavLink to="/deliveries" className={linkClass}>
          {({ isActive }) => (
            <>
              <Truck size={24} aria-hidden />
              <span aria-current={isActive ? "page" : undefined}>Deliveries</span>
            </>
          )}
        </NavLink>
        <NavLink to="/milk-collections" className={linkClass}>
          {({ isActive }) => (
            <>
              <Droplets size={24} aria-hidden />
              <span aria-current={isActive ? "page" : undefined}>Collections</span>
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
