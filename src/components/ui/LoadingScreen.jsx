export default function LoadingScreen({ text, compact = false }) {
  return (
    <div className={compact ? "loading-inline" : "loading-screen"}>
      <div className="loading-dot" />
      <p>{text || "Loading..."}</p>
    </div>
  );
}
