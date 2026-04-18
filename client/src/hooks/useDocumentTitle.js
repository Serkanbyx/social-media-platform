import { useEffect } from "react";

const APP_NAME = "Pulse";

/**
 * useDocumentTitle — sets `document.title` to `"{title} · Pulse"` for the
 * lifetime of the component, restoring the previous title on unmount so
 * back navigation doesn't leave a stale title behind.
 *
 * Pass `null` (or omit `title`) to fall back to just the app name.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const previous = document.title;
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export default useDocumentTitle;
