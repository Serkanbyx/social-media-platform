import { useCallback, useEffect } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";

/**
 * useUnsavedChangesPrompt — guard against losing in-progress edits.
 *
 * Surfaces two protections when `dirty` is true:
 *  1. Native `beforeunload` warning — covers tab close, hard refresh,
 *     and back/forward navigation outside the SPA.
 *  2. React Router `useBlocker` — intercepts in-app navigation so the
 *     consumer can render a confirm modal before leaving the route.
 *
 * The hook returns the blocker controls plus an `open` boolean that
 * mirrors `blocker.state === "blocked"` — handy for binding directly
 * to a `<ConfirmModal open={…} />` without re-deriving the state in
 * every consumer.
 *
 * @param {boolean} dirty - whether the form has unsaved changes
 */
export default function useUnsavedChangesPrompt(dirty) {
  useBeforeUnload(
    useCallback(
      (event) => {
        if (!dirty) return undefined;
        event.preventDefault();
        // Required for Chrome — the actual string is ignored by every
        // modern browser but the property must be set.
        event.returnValue = "";
        return "";
      },
      [dirty]
    )
  );

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        dirty && currentLocation.pathname !== nextLocation.pathname,
      [dirty]
    )
  );

  // If the dirty flag flips back to `false` while a navigation is
  // pending (e.g. the user just hit Save and the resulting redirect
  // should pass through), let it through automatically instead of
  // surfacing a confusing "unsaved changes" prompt for nothing.
  useEffect(() => {
    if (!dirty && blocker.state === "blocked") {
      blocker.proceed?.();
    }
  }, [dirty, blocker]);

  const confirmLeave = useCallback(() => {
    blocker.proceed?.();
  }, [blocker]);

  const cancelLeave = useCallback(() => {
    blocker.reset?.();
  }, [blocker]);

  return {
    open: blocker.state === "blocked",
    confirmLeave,
    cancelLeave,
  };
}
