import Modal from "./Modal";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  variant = "danger",
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="confirm-actions">
          <button className="mini-button" onClick={onClose} disabled={loading} type="button">
            {cancelText}
          </button>
          <button
            className={`mini-button ${variant === "danger" ? "danger" : "active"}`}
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? "Processing..." : confirmText}
          </button>
        </div>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
