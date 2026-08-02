import { AlertTriangle } from "lucide-react";

export default function PageError({ message, onRetry, retryLabel = "Retry" }) {
  return (
    <div className="page-error" role="alert">
      <AlertTriangle size={20} aria-hidden />
      <p>{message || "Something went wrong while loading this page."}</p>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
