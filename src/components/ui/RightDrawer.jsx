import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

export default function RightDrawer({ open, onClose, title, children, footer }) {
  const drawerRef = useRef(null);
  const onCloseRef = useRef(null);
  const triggerRef = useRef(null);
  useBodyScrollLock(open);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement;

    const drawer = drawerRef.current;
    const focusable = drawer?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable?.length > 0) focusable[0].focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab") {
        const focusableElements = drawerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements.length) return;
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
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [open]);

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
          <button className="right-drawer-close icon-button" onClick={onClose} type="button" aria-label="Close panel">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="right-drawer-body">{children}</div>
        {footer && <div className="right-drawer-footer">{footer}</div>}
      </div>
    </div>
  );
}
