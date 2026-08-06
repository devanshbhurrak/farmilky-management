import { useEffect, useRef } from "react";

/**
 * Traps focus inside a container while active, restores focus to the
 * previously focused element (trigger) on close, and handles Escape.
 * The effect only reacts to the `active` transition, so re-renders while
 * open (e.g. typing in a form) never steal focus back to the first element.
 * @param {object} options
 * @param {boolean} options.active - Whether the trap is active
 * @param {() => void} options.onClose - Called on Escape
 * @param {boolean} options.autoFocus - Focus the first focusable element on open
 */
export function useFocusTrap({ active, onClose, autoFocus = true }) {
  const containerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const autoFocusRef = useRef(autoFocus);
  autoFocusRef.current = autoFocus;
  const wasActiveRef = useRef(false);

  useEffect(() => {
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = active;

    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement;

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const getFocusables = () =>
      Array.from(container.querySelectorAll(focusableSelector)).filter(
        (el) => el.offsetParent !== null
      );

    if (autoFocusRef.current && !wasActive) {
      const first = getFocusables()[0];
      if (first) first.focus();
    }

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusables();
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return containerRef;
}
