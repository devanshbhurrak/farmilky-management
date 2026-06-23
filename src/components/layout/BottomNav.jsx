import { NavLink } from "react-router-dom";
import { LayoutDashboard, Truck, ShoppingCart, MoreHorizontal, ClipboardList } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function BottomNav({ onMoreClick }) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <nav className="bottom-nav hide-desktop">
        <div className="bottom-nav-inner delivery-nav-inner">
          <NavLink
            to="/agent"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            {({ isActive }) => (
              <>
                <ClipboardList size={24} aria-hidden />
                <span aria-current={isActive ? "page" : undefined}>Today</span>
              </>
            )}
          </NavLink>
          <NavLink
            to="/deliveries"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            {({ isActive }) => (
              <>
                <Truck size={24} aria-hidden />
                <span aria-current={isActive ? "page" : undefined}>Deliveries</span>
              </>
            )}
          </NavLink>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bottom-nav hide-desktop">
      <div className="bottom-nav-inner">
        <NavLink
          to="/"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          end
        >
          {({ isActive }) => (
            <>
              <LayoutDashboard size={24} aria-hidden />
              <span aria-current={isActive ? "page" : undefined}>Home</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/deliveries"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <Truck size={24} aria-hidden />
              <span aria-current={isActive ? "page" : undefined}>Deliveries</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/orders"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          {({ isActive }) => (
            <>
              <ShoppingCart size={24} aria-hidden />
              <span aria-current={isActive ? "page" : undefined}>Orders</span>
            </>
          )}
        </NavLink>
        <button type="button" className="nav-item" onClick={onMoreClick} aria-haspopup="dialog">
          <MoreHorizontal size={24} />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
