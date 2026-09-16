export default function ActionRow({ current, options, onSelect }) {
  return (
    <div className="action-row">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={current === option ? "btn btn-sm active" : "btn btn-sm"}
          disabled={current === option}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
