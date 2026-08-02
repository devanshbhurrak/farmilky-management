import { useEffect } from "react";

let lockCount = 0;
let originalOverflow = null;
let originalPaddingRight = "";

/**
 * Custom hook to lock body scroll when a component is mounted.
 * Ref-counted so nested overlays (e.g. drawer + confirm sheet)
 * only release the lock once every locker has unmounted.
 * @param {boolean} isLocked - Whether scroll should be locked
 */
export function useBodyScrollLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return;

    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow;
      originalPaddingRight = document.body.style.paddingRight;

      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
        originalOverflow = null;
        originalPaddingRight = "";
      }
    };
  }, [isLocked]);
}
