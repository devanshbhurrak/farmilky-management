import { useEffect } from "react";

/**
 * Custom hook to lock body scroll when a component is mounted
 * Useful for modals, drawers, and bottom sheets
 * @param {boolean} isLocked - Whether scroll should be locked
 */
export function useBodyScrollLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isLocked]);
}
