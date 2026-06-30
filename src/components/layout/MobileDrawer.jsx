import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useAuth } from "../../context/AuthContext";
import { navItems, deliveryNavItems } from "../../utils/constants";
import NavIcon from "../icons/NavIcon";

export default function MobileDrawer({ isOpen, onClose }) {
  const drawerRef = useRef(null);
  const { isAdmin } = useAuth();
  useBodyScrollLock(isOpen);

  const items = isAdmin ? navItems : deliveryNavItems;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusableElements = drawerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="mobile-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()} ref={drawerRef}>
          <div className="drawer-header">
            <h2 id="drawer-title">Menu</h2>
            <button onClick={onClose} className="drawer-close" aria-label="Close menu">
              <X size={24} />
            </button>
          </div>
        <div className="mobile-drawer-inner">
          <div className="drawer-nav">
            {items.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === "/"}
                className="drawer-link"
                onClick={onClose}
              >
                <NavIcon name={item.icon} size={20} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
