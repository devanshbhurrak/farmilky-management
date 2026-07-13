import { Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { navItems, deliveryNavItems } from "../../utils/constants";
import NavIcon from "../icons/NavIcon";

export default function Sidebar({ collapsed, onToggle }) {
  const { isAdmin } = useAuth();
  const items = isAdmin ? navItems : deliveryNavItems;

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        {!collapsed && <span className="brand-mark">Farmilky</span>}
        <button
          className="sidebar-toggle icon-button"
          onClick={onToggle}
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            title={collapsed ? item.label : undefined}
            aria-current={({ isActive }) => isActive ? "page" : undefined}
          >
            <span className="sidebar-icon">
              <NavIcon name={item.icon} />
            </span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
