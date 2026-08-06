import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";

/**
 * Styled dropdown that replaces native <select> so the options list
 * renders consistently across browsers. Trigger keeps the df-icon-select
 * chip look (icon + label + chevron).
 * @param {React.ReactNode} icon - Already-rendered icon node
 * @param {string} value - Current option value
 * @param {(value: string) => void} onChange
 * @param {Array<{value: string, label: string}>} options
 */
export default function IconDropdown({ icon, value, onChange, options, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const active = value !== options[0]?.value;
  const label = options.find((o) => o.value === value)?.label || options[0]?.label;

  return (
    <div
      ref={rootRef}
      className={`df-icon-select df-icon-dropdown${active ? " df-icon-select--active" : ""}${open ? " df-icon-select--open" : ""}`}
    >
      {icon}
      <button
        type="button"
        className="df-icon-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="df-icon-select-label">{label}</span>
      </button>
      {open && (
        <ul className="df-icon-dropdown-menu" role="listbox">
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={`df-icon-dropdown-item${o.value === value ? " active" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={14} className="df-icon-dropdown-check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
