import { useRef, useState } from "react";
import Modal from "./Modal.jsx";
import Button from "./Button.jsx";

/**
 * ConfirmModal — opinionated wrapper around Modal for yes/no flows
 * (delete post, unfollow user, sign out everywhere…).
 *
 * Cancel button is auto-focused as a safer default for destructive
 * actions: pressing Enter immediately after open dismisses the dialog
 * rather than confirming.
 *
 * `onConfirm` may return a Promise — while it's pending we mark the
 * confirm button as `loading` and disable cancel so the user can't
 * trigger the action twice.
 */
export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  danger = false,
  onConfirm,
  onCancel,
  busyLabel,
}) {
  const cancelRef = useRef(null);
  const [pending, setPending] = useState(false);

  // Reset the in-flight flag whenever the dialog closes externally
  // (e.g. parent toggles `open` while a request is still pending).
  // Done during render — React's recommended alternative to a reset effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open && pending) setPending(false);
  }

  const handleConfirm = async () => {
    if (typeof onConfirm !== "function") return;
    try {
      const result = onConfirm();
      if (result && typeof result.then === "function") {
        setPending(true);
        await result;
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={pending ? undefined : onCancel}
      title={title}
      description={description}
      size="sm"
      initialFocusRef={cancelRef}
      closeOnBackdrop={!pending}
      hideCloseButton
      footer={
        <>
          <Button
            ref={cancelRef}
            variant="ghost"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={pending}
            onClick={handleConfirm}
          >
            {pending && busyLabel ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      {/* Description already rendered in Modal header — children slot left
          intentionally empty so callers can add extra context if needed. */}
    </Modal>
  );
}
