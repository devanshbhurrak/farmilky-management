import { X } from "lucide-react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

export default function RightDrawer({ open, onClose, title, children, footer }) {
  useBodyScrollLock(open);
  const drawerRef = useFocusTrap({ active: open, onClose });

  if (!open) return null;

  return (
    <div className="right-drawer-overlay" onClick={onClose}>
      <div
        className="right-drawer-content"
        onClick={(e) => e.stopPropagation()}
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="right-drawer-title"
      >
        <div className="right-drawer-header">
          <h3 id="right-drawer-title">{title || "Panel"}</h3>
          <button
            className="surface-close"
            onClick={onClose}
            type="button"
            aria-label="Close panel"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="right-drawer-body">{children}</div>
        {footer && <div className="right-drawer-footer">{footer}</div>}
      </div>
    </div>
  );
}
