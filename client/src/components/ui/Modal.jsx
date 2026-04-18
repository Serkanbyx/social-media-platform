import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscapeKey } from "../../hooks/useEscapeKey.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import IconButton from "./IconButton.jsx";
import { cn } from "../../utils/cn.js";

/**
 * Modal — accessible dialog primitive used by ConfirmModal, the post
 * composer dialog, settings sub-flows, etc.
 *
 * Behaviours:
 *  - Renders into `document.body` so the panel escapes any clipped
 *    parent (overflow:hidden cards, sticky navbars).
 *  - Locks body scroll while open.
 *  - Focus trap inside the panel; on close, focus returns to the
 *    element that opened the modal.
 *  - ESC + backdrop click both call `onClose` (configurable).
 *  - Below the `sm` breakpoint the panel becomes a bottom sheet.
 *
 * The component intentionally renders nothing while `open` is false so
 * mounting it conditionally never causes a flash on initial paint.
 */
const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-3xl",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  closeOnBackdrop = true,
  hideCloseButton = false,
  initialFocusRef,
  footer,
  children,
  className = "",
}) {
  const reactId = useId();
  const titleId = `modal-title-${reactId}`;
  const descId = `modal-desc-${reactId}`;
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const isMobile = useMediaQuery("(max-width: 639px)");

  const handleClose = useCallback(() => {
    if (typeof onClose === "function") onClose();
  }, [onClose]);

  useEscapeKey(handleClose, open);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const focusInitial = () => {
      const target =
        initialFocusRef?.current ||
        panelRef.current?.querySelector(FOCUSABLE_SELECTOR) ||
        panelRef.current;
      target?.focus?.({ preventScroll: true });
    };

    const id = window.requestAnimationFrame(focusInitial);

    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = overflow;
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === "function") {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll(FOCUSABLE_SELECTOR);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const sheetClasses = isMobile
    ? "fixed inset-x-0 bottom-0 w-full max-w-full rounded-t-2xl rounded-b-none animate-fade-up"
    : cn(
        "fixed left-1/2 top-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl animate-modal-in",
        SIZES[size] || SIZES.md
      );

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={closeOnBackdrop ? handleClose : undefined}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "surface-overlay focus:outline-none",
          sheetClasses,
          className
        )}
      >
        {(title || !hideCloseButton) && (
          <header className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div className="min-w-0 flex-1">
              {title && (
                <h2
                  id={titleId}
                  className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id={descId}
                  className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400"
                >
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <IconButton
                icon={X}
                size="sm"
                aria-label="Kapat"
                onClick={handleClose}
                className="-mr-1"
              />
            )}
          </header>
        )}

        <div className="px-5 py-4 text-sm text-zinc-700 dark:text-zinc-200">
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
