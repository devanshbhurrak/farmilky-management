import { Inbox } from "lucide-react";

export default function EmptyState({ text, sub, action, icon: Icon = Inbox }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={32} strokeWidth={1.5} aria-hidden />
      </div>
      <p>{text || "No data available."}</p>
      {sub && <p className="empty-state-sub">{sub}</p>}
      {action && (
        <button
          type="button"
          className={action.className || "btn btn-sm btn-primary"}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
