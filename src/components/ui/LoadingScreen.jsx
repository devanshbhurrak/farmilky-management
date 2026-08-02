export default function LoadingScreen({ text, compact = false }) {
  return (
    <div
      className={compact ? "loading-inline" : "loading-screen"}
      role="status"
      aria-live="polite"
    >
      <div className="loading-dot" aria-hidden />
      <p>{text || "Loading..."}</p>
    </div>
  );
}
