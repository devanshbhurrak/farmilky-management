export default function StickyActionBar({ children, visible = true }) {
  if (!visible) return null;

  return (
    <div className="sticky-action-bar">
      <div className="sticky-action-bar-inner">
        {children}
      </div>
    </div>
  );
}
