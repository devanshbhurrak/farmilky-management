import { X } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

const CLOSE_THRESHOLD = 90;

/**
 * Reusable Bottom Sheet component
 * @param {boolean} isOpen - Whether the sheet is open
 * @param {function} onClose - Function to close the sheet
 * @param {string} title - Optional title for the sheet
 * @param {React.ReactNode} children - Content of the sheet
 */
export default function BottomSheet({ isOpen, onClose, title, children }) {
  useBodyScrollLock(isOpen);
  const sheetRef = useFocusTrap({ active: isOpen, onClose });

  const startY = useRef(null);
  const [dragY, setDragY] = useState(0);
  const dragging = dragY > 0;

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    startY.current = touch.clientY;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setDragY(dy);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragY >= CLOSE_THRESHOLD) {
      onClose();
    }
    startY.current = null;
    setDragY(0);
  }, [dragY, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="bottom-sheet-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "sheet-title" : undefined}
      aria-label={title ? undefined : "Options"}
    >
      <div
        className={`bottom-sheet-content${dragging ? " dragging" : ""}`}
        style={dragging ? { transform: `translateY(${dragY}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
        ref={sheetRef}
      >
        <div
          className="bottom-sheet-header"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="bottom-sheet-drag-handle" aria-hidden="true" />
          <div className="bottom-sheet-header-main">
            {title && <h3 id="sheet-title">{title}</h3>}
            <button
              className="surface-close"
              onClick={onClose}
              aria-label="Close sheet"
            >
              <X size={20} aria-hidden />
            </button>
          </div>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </div>
  );
}
