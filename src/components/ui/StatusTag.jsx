export default function StatusTag({ value }) {
  return (
    <span 
      className={`status-tag status-${value}`}
      aria-label={`Status: ${value}`}
    >
      {value}
    </span>
  );
}
