export default function ActionRow({ current, options, onSelect }) {
  return (
    <div className="action-row">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={current === option ? "mini-button active" : "mini-button"}
          disabled={current === option}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
