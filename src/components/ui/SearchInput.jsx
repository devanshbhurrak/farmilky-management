import { Search, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useDebounce } from "../../hooks/useDebounce";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  maxWidth,
}) {
  const [local, setLocal] = useState(value || "");
  const debounced = useDebounce(local, 300);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!firstRender.current) setLocal(value || "");
    firstRender.current = false;
  }, [value]);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <label className="search-box" style={maxWidth ? { maxWidth } : undefined}>
      <Search size={18} className="search-box-icon" aria-hidden />
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {local && (
        <button
          type="button"
          className="search-clear-btn"
          onClick={() => {
            setLocal("");
            onChange("");
          }}
          aria-label={`Clear ${placeholder}`}
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </label>
  );
}
