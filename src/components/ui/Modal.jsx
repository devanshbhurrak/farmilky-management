import { X } from "lucide-react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

export default function Modal({ open, onClose, title, children, footer }) {
  useBodyScrollLock(open);
  const modalRef = useFocusTrap({ active: open, onClose });

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h3 id="modal-title">{title || "Modal"}</h3>
          <button
            className="surface-close"
            onClick={onClose}
            type="button"
            aria-label="Close modal"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
