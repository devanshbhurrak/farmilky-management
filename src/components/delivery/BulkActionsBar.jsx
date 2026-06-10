import { CheckSquare } from "lucide-react";

export default function BulkActionsBar({ selectedCount, onBulkDeliver, visible }) {
  if (!visible || selectedCount === 0) return null;

  return (
    <div className="bulk-actions-bar">
      <div className="bulk-actions-inner">
        <div className="selection-info">
          <strong>{selectedCount}</strong>
          <span>stops selected</span>
        </div>
        <button className="bulk-deliver-btn" onClick={onBulkDeliver}>
          <CheckSquare size={20} />
          <span>Deliver All</span>
        </button>
      </div>
    </div>
  );
}
