export default function LoadingSkeleton({ rows = 5, columns = 4, width, height }) {
  if (width || height) {
    return (
      <div
        className="skeleton-bar"
        style={{
          width: width || "100%",
          height: height || "16px",
          borderRadius: "var(--radius-sm)",
        }}
      />
    );
  }

  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <div className="skeleton-cell" key={j}>
              {/* Deterministic pseudo-random width per cell */}
              <div
                className="skeleton-bar"
                style={{ width: `${60 + ((i * 37 + j * 23) % 30)}%` }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
