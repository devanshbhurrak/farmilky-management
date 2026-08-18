const DEFAULT_STATUSES = new Set([
  "active", "inactive", "delivered", "confirmed", "paid", "unpaid",
  "paused", "pending", "placed", "partial", "cancelled", "failed",
  "open", "in_progress", "resolved", "completed", "approved",
  "closed", "rejected", "subscription", "order", "offline", "skipped",
]);

export default function StatusTag({ value, label }) {
  const display = value ?? "";
  return (
    <span
      className={`status-tag status-${display}`}
      aria-label={
        label ||
        (DEFAULT_STATUSES.has(display) ? `Status: ${display}` : display)
      }
    >
      {display}
    </span>
  );
}
