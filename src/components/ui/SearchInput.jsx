import { Search } from "lucide-react";
import { useState, useEffect } from "react";

export default function SearchInput({ value, onChange, placeholder = "Search..." }) {
  const [local, setLocal] = useState(value || "");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocal(value || ""); }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== value) onChange(local);
    }, 300);
    return () => clearTimeout(timer);
  }, [local, value, onChange]);

  return (
    <label className="search-box">
      <span className="sr-only">{placeholder}</span>
      <Search size={18} className="search-box-icon" aria-hidden />
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
