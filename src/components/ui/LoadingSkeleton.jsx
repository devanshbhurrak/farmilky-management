export default function LoadingSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <div className="skeleton-cell" key={j}>
              <div className="skeleton-bar" style={{ width: `${60 + Math.random() * 30}%` }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
