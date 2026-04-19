import { cloneElement, useCallback, useId, useRef, useState } from "react";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { useEscapeKey } from "../../hooks/useEscapeKey.js";
import { cn } from "../../utils/cn.js";

/**
 * Popover — generic floating panel anchored to a trigger.
 *
 * Distinct from Dropdown because the content can be anything (rich
 * panels, emoji picker, notification preview) — Popover only owns the
 * open/close lifecycle, not the inner layout.
 *
 * Triggers passed as children should be a single React element so we
 * can attach the open/close handlers via `cloneElement`.
 */
const ALIGN_CLASSES = {
  start: "left-0 origin-top-left",
  center: "left-1/2 -translate-x-1/2 origin-top",
  end: "right-0 origin-top-right",
};

export default function Popover({
  trigger,
  children,
  align = "end",
  width = "w-72",
  className = "",
  panelClassName = "",
  defaultOpen = false,
}) {
  const reactId = useId();
  const panelId = `popover-${reactId}`;
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(defaultOpen);

  const close = () => setOpen(false);

  // Trigger is the first focusable child inside the wrapper. Looking it
  // up on demand avoids cloneElement-with-ref-callback, which React
  // Compiler can't analyse safely.
  const focusTrigger = () => {
    const node = wrapperRef.current?.querySelector(
      '[aria-haspopup="dialog"]'
    );
    node?.focus?.({ preventScroll: true });
  };

  useClickOutside(wrapperRef, close, open);
  useEscapeKey(() => {
    setOpen(false);
    focusTrigger();
  }, open);

  const originalTriggerOnClick = trigger.props.onClick;
  const handleTriggerClick = useCallback(
    (event) => {
      originalTriggerOnClick?.(event);
      if (!event.defaultPrevented) setOpen((value) => !value);
    },
    [originalTriggerOnClick]
  );

  const triggerEl = cloneElement(trigger, {
    onClick: handleTriggerClick,
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    "aria-controls": panelId,
  });

  const renderedChildren =
    typeof children === "function" ? children({ close }) : children;

  return (
    <div ref={wrapperRef} className={cn("relative inline-block", className)}>
      {triggerEl}
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          className={cn(
            "absolute top-full z-40 mt-2 overflow-hidden rounded-xl surface-overlay animate-modal-in",
            ALIGN_CLASSES[align] || ALIGN_CLASSES.end,
            width,
            panelClassName
          )}
        >
          {renderedChildren}
        </div>
      )}
    </div>
  );
}
