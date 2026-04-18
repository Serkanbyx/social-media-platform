import { useCallback, useEffect, useState } from "react";

const isBrowser = typeof window !== "undefined";

const readValue = (key, initial) => {
  if (!isBrowser) return typeof initial === "function" ? initial() : initial;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return typeof initial === "function" ? initial() : initial;
    }
    return JSON.parse(raw);
  } catch {
    return typeof initial === "function" ? initial() : initial;
  }
};

/**
 * useLocalStorage — JSON-safe, SSR-safe persisted state hook.
 *
 * Returns `[value, setValue, remove]`. `setValue` accepts the same
 * functional updater shape as `useState`. A cross-tab `storage` listener
 * keeps every open tab in sync when one tab writes a new value.
 */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => readValue(key, initial));

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (isBrowser) {
          try {
            if (resolved === undefined || resolved === null) {
              window.localStorage.removeItem(key);
            } else {
              window.localStorage.setItem(key, JSON.stringify(resolved));
            }
          } catch {
            // Quota or private-mode failure — keep the in-memory value.
          }
        }
        return resolved;
      });
    },
    [key]
  );

  const remove = useCallback(() => {
    if (isBrowser) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignored
      }
    }
    setValue(typeof initial === "function" ? initial() : initial);
  }, [key, initial]);

  useEffect(() => {
    if (!isBrowser) return undefined;
    const handler = (event) => {
      if (event.key !== key) return;
      try {
        setValue(
          event.newValue === null
            ? typeof initial === "function"
              ? initial()
              : initial
            : JSON.parse(event.newValue)
        );
      } catch {
        // Malformed JSON written by another tab — ignore.
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [key, initial]);

  return [value, update, remove];
}

export default useLocalStorage;
