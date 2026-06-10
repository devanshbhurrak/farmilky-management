import { Inbox } from "lucide-react";

export default function EmptyState({ text, action, icon: Icon = Inbox }) {
  return (
    <div className="empty-state">
      <Icon size={28} strokeWidth={1.5} aria-hidden />
      <p>{text || "No data available."}</p>
      {action && (
        <button
          type="button"
          className={action.className || "mini-button active"}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
