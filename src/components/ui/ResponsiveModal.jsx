import Modal from "./Modal";
import BottomSheet from "./BottomSheet";
import { useMediaQuery } from "../../hooks/useMediaQuery";

export default function ResponsiveModal({ open, onClose, title, children, footer }) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (isMobile) {
    return (
      <BottomSheet isOpen={open} onClose={onClose} title={title}>
        {children}
        {footer && <div className="bottom-sheet-footer">{footer}</div>}
      </BottomSheet>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title} footer={footer}>
      {children}
    </Modal>
  );
}
