import { useEffect, useState } from "react";

/**
 * useDebounce — returns the latest `value` only after it has been stable
 * for `delay` milliseconds.
 *
 * Pattern of choice for typeahead / search fields where we want to keep
 * the input snappy (controlled state updates immediately) while throttling
 * any expensive side effects (network calls, filtering big lists).
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;
