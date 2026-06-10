import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

/**
 * Reusable Bottom Sheet component
 * @param {boolean} isOpen - Whether the sheet is open
 * @param {function} onClose - Function to close the sheet
 * @param {string} title - Optional title for the sheet
 * @param {React.ReactNode} children - Content of the sheet
 */
export default function BottomSheet({ isOpen, onClose, title, children }) {
  const sheetRef = useRef(null);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusableElements = sheetRef.current.querySelectorAll(
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
    <div className="bottom-sheet-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()} ref={sheetRef}>
        <div className="bottom-sheet-header">
          <div className="bottom-sheet-drag-handle" />
          <div className="bottom-sheet-header-main">
            {title && <h3 id="sheet-title">{title}</h3>}
            <button className="bottom-sheet-close" onClick={onClose} aria-label="Close sheet">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="bottom-sheet-body">
          {children}
        </div>
      </div>
    </div>
  );
}
