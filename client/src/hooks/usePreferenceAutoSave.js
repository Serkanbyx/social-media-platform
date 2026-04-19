import { useCallback, useEffect, useRef, useState } from "react";

import { usePreferences } from "../context/PreferencesContext.jsx";
import notify from "../utils/notify.js";

const SAVE_INDICATOR_MS = 1500;
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * usePreferenceAutoSave — auto-save adapter for the Settings toggles and
 * segmented selectors.
 *
 * Returns:
 *  - `save(path, value)` — debounced (per-path) `updatePreference` call.
 *    The optimistic update inside `PreferencesContext` happens on every
 *    invocation so the UI stays in sync; only the network round trip is
 *    debounced.
 *  - `savedKey` — the most recently persisted path; consumers compare
 *    against their own field path to render `<SaveIndicator visible />`
 *    for ~1.5 s after a successful save.
 *
 * Errors surface as a single toast (per the STEP 35 brief: "Never show a
 * full toast on every toggle; only toast on error"). The optimistic state
 * inside `PreferencesContext` rolls itself back so the indicator stays
 * faithful to what's actually persisted.
 */
export default function usePreferenceAutoSave({
  debounceMs = DEFAULT_DEBOUNCE_MS,
} = {}) {
  const { updatePreference } = usePreferences();
  const [savedKey, setSavedKey] = useState(null);

  const timersRef = useRef(new Map());
  const indicatorTimerRef = useRef(null);

  useEffect(
    () => () => {
      for (const id of timersRef.current.values()) {
        window.clearTimeout(id);
      }
      timersRef.current.clear();
      if (indicatorTimerRef.current) {
        window.clearTimeout(indicatorTimerRef.current);
      }
    },
    []
  );

  const flashSaved = useCallback((path) => {
    setSavedKey(path);
    if (indicatorTimerRef.current) {
      window.clearTimeout(indicatorTimerRef.current);
    }
    indicatorTimerRef.current = window.setTimeout(() => {
      setSavedKey((current) => (current === path ? null : current));
      indicatorTimerRef.current = null;
    }, SAVE_INDICATOR_MS);
  }, []);

  const save = useCallback(
    (path, value) => {
      const previous = timersRef.current.get(path);
      if (previous) window.clearTimeout(previous);

      const timeoutId = window.setTimeout(async () => {
        timersRef.current.delete(path);
        try {
          await updatePreference(path, value);
          flashSaved(path);
        } catch (error) {
          const message =
            error?.response?.data?.message ||
            "Tercih kaydedilemedi. Lütfen tekrar dene.";
          notify.error(message);
        }
      }, debounceMs);

      timersRef.current.set(path, timeoutId);
    },
    [debounceMs, flashSaved, updatePreference]
  );

  return { save, savedKey };
}
