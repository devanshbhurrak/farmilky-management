export default function QuickChips({ options, selected, onSelect }) {
  return (
    <div className="quick-chips">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`chip ${selected === option.value ? "active" : ""}`}
          onClick={() => onSelect(option.value)}
          aria-pressed={selected === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
