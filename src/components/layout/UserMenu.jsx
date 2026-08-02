import { useState, useRef, useEffect } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function getInitials(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const initials = getInitials(user?.name);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector(".user-menu-trigger")?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="user-menu-trigger"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user?.name || "user"}`}
      >
        {initials}
      </button>
      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-header">
            <span className="user-menu-header-avatar" aria-hidden>
              {initials}
            </span>
            <div>
              <div className="user-menu-name">{user?.name}</div>
              <div className="user-menu-role">{user?.role}</div>
            </div>
          </div>
          <button
            className="user-menu-logout"
            type="button"
            role="menuitem"
            onClick={logout}
          >
            <LogOut size={16} aria-hidden />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
