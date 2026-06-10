import BottomSheet from "./BottomSheet";

/**
 * Specialized Bottom Sheet for filters
 * @param {boolean} isOpen - Whether the sheet is open
 * @param {function} onClose - Function to close the sheet
 * @param {React.ReactNode} children - Filter controls
 */
export default function FilterSheet({ isOpen, onClose, children }) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Filters">
      <div className="filter-sheet-content">
        {children}
      </div>
    </BottomSheet>
  );
}
