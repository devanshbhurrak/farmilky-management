import { NavLink } from "react-router-dom";
import { X, LogOut } from "lucide-react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useAuth } from "../../context/AuthContext";
import { navItems, deliveryNavItems } from "../../utils/constants";
import NavIcon from "../icons/NavIcon";

export default function MobileDrawer({ isOpen, onClose }) {
  const { isAdmin, hasPermission, logout } = useAuth();
  useBodyScrollLock(isOpen);
  const drawerRef = useFocusTrap({ active: isOpen, onClose });

  const items = isAdmin
    ? navItems
    : deliveryNavItems.filter((item) => !item.permission || hasPermission(item.permission));

  if (!isOpen) return null;

  function handleLogout() {
    logout();
    onClose();
  }

  return (
    <div
      className="mobile-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div
        className="mobile-drawer-content"
        onClick={(e) => e.stopPropagation()}
        ref={drawerRef}
      >
        <div className="drawer-drag-handle" aria-hidden="true" />
        <div className="drawer-header">
          <h2 id="drawer-title">Navigation</h2>
          <button onClick={onClose} className="surface-close" aria-label="Close menu">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="mobile-drawer-inner">
          <nav aria-label="More navigation">
            <div className="drawer-nav">
              {items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === "/"}
                  className="drawer-link"
                  onClick={onClose}
                >
                  <span className="drawer-link-icon" aria-hidden="true">
                    <NavIcon name={item.icon} size={18} />
                  </span>
                  <span className="drawer-link-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Sign out button for delivery agents */}
          {!isAdmin && (
            <div className="drawer-footer">
              <button
                type="button"
                className="drawer-link drawer-logout-btn"
                onClick={handleLogout}
              >
                <span className="drawer-link-icon" aria-hidden="true">
                  <LogOut size={18} />
                </span>
                <span className="drawer-link-label">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
