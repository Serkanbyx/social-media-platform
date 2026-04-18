import { useEffect } from "react";

/**
 * useEscapeKey — fires `handler` whenever the user presses Escape.
 *
 * Used by Modal, Dropdown, Popover and the search overlay. We listen
 * during the capture phase so a modal can swallow the event before a
 * background dropdown reacts to it.
 */
export function useEscapeKey(handler, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof handler !== "function") return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" || event.key === "Esc") handler(event);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [handler, enabled]);
}

export default useEscapeKey;
