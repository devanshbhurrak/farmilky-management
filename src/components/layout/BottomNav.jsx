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
                  <span className="nav-item-icon-wrap">
                    <NavIcon name={item.icon} size={22} />
                  </span>
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
              <span className="nav-item-icon-wrap">
                <LayoutDashboard size={22} aria-hidden />
              </span>
              <span aria-current={isActive ? "page" : undefined}>Home</span>
            </>
          )}
        </NavLink>
        <NavLink to="/deliveries" className={linkClass}>
          {({ isActive }) => (
            <>
              <span className="nav-item-icon-wrap">
                <Truck size={22} aria-hidden />
              </span>
              <span aria-current={isActive ? "page" : undefined}>Deliveries</span>
            </>
          )}
        </NavLink>
        <NavLink to="/milk-collections" className={linkClass}>
          {({ isActive }) => (
            <>
              <span className="nav-item-icon-wrap">
                <Droplets size={22} aria-hidden />
              </span>
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
          <span className="nav-item-icon-wrap">
            <MoreHorizontal size={22} aria-hidden />
          </span>
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
