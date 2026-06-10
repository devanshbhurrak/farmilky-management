import { useState, useRef, useCallback } from "react";

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 } = {}) {
  const [swiping, setSwiping] = useState(null);
  const startX = useRef(0);
  const startY = useRef(0);

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    setSwiping(true);
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (!swiping) return;
    setSwiping(false);

    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      if (dx > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    }
  }, [swiping, threshold, onSwipeLeft, onSwipeRight]);

  return { swiping, onTouchStart, onTouchEnd };
}