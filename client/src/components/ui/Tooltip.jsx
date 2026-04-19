import { cloneElement, useId, useRef, useState } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { cn } from "../../utils/cn.js";

/**
 * Tooltip — hover/focus-triggered hint shown above or below a trigger.
 *
 * - Disabled on touch-only devices (no hover): on coarse pointers we
 *   simply render the children, since attempting to "hover" forces an
 *   awkward long-press interaction.
 * - 400 ms open delay so quick mouse movements don't flash tooltips
 *   across the page.
 * - Trigger is wired with `aria-describedby` only while the tooltip is
 *   open — when hidden we don't pollute the accessibility tree.
 */
const SIDES = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
};

const OPEN_DELAY_MS = 400;

export default function Tooltip({ content, children, side = "top" }) {
  const reactId = useId();
  const tooltipId = `tooltip-${reactId}`;
  const timerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const isCoarsePointer = useMediaQuery("(hover: none)");

  if (isCoarsePointer || !content) {
    return children;
  }

  const show = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };

  const hide = () => {
    window.clearTimeout(timerRef.current);
    setOpen(false);
  };

  // Only inject aria-describedby into the trigger (screen readers need
  // it on the focusable node). All event handlers live on the wrapper
  // span — React's synthetic onFocus/onBlur bubble, so this catches
  // hover and keyboard focus on the underlying trigger transparently.
  // Avoiding handler injection via cloneElement keeps React Compiler
  // from flagging "ref read during render".
  const childDescribedBy = children.props["aria-describedby"];
  const triggerEl = cloneElement(children, {
    "aria-describedby": open
      ? cn(childDescribedBy, tooltipId)
      : childDescribedBy,
  });

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {triggerEl}
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-40 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-2xs font-medium text-white shadow-md animate-fade-up dark:bg-zinc-100 dark:text-zinc-900",
            SIDES[side] || SIDES.top
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
