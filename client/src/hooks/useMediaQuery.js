import { useEffect, useState } from "react";

const isBrowser = typeof window !== "undefined" && typeof window.matchMedia === "function";

/**
 * useMediaQuery — boolean reflecting whether the given CSS media query
 * currently matches. Uses `matchMedia` event listeners (not `resize`) so
 * we only re-render when the query result actually changes.
 *
 * Common consumers: theme system preference (`prefers-color-scheme: dark`),
 * reduced motion preference, and viewport breakpoint detection.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    isBrowser ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (!isBrowser) return undefined;
    const mql = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);

    // Sync once on mount in case the query changed between the initial
    // `useState` evaluation and this effect (e.g. when SSR-rehydrating
    // or when `query` itself changes between renders). This is a
    // documented exception to the no-set-state-in-effect rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mql.matches);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);

  return matches;
}

export default useMediaQuery;
