import { useCallback, useEffect, useMemo } from "react";

import * as userService from "../services/userService.js";
import { useAuth } from "./useAuth.js";
import { PreferencesContext } from "./usePreferences.js";

/**
 * PreferencesContext — derives UI preferences from the authenticated user
 * and persists changes back through the profile endpoint.
 *
 * Design notes:
 *  - Source of truth lives on the server (`User.preferences`) so a user
 *    sees the same theme/language across devices. We don't duplicate it in
 *    localStorage — that would silently desync.
 *  - The `theme` is applied to `<html>` via the `dark` class. When set to
 *    `"system"` we also subscribe to `matchMedia('(prefers-color-scheme: dark)')`
 *    so the page reacts the moment the OS toggles, with no manual refresh.
 *  - `fontSize`, `reduceMotion` and `compactMode` are mirrored to the same
 *    `<html>` element via dedicated classes. Keeping every UI-affecting
 *    preference applied at the document root means consumers never have
 *    to thread the values through the component tree.
 *  - `updatePreference(path, value)` is optimistic: we update the user
 *    object in `AuthContext` first, then PATCH the server. On failure we
 *    roll back so the UI never lies about persisted state.
 */

const FONT_SIZE_CLASSES = ["font-size-sm", "font-size-md", "font-size-lg"];
const FONT_SIZE_TO_CLASS = {
  sm: "font-size-sm",
  md: "font-size-md",
  lg: "font-size-lg",
};

const DEFAULT_PREFERENCES = {
  theme: "system",
  language: "en",
  fontSize: "md",
  reduceMotion: false,
  compactMode: false,
  privacy: { showEmail: false, privateAccount: false },
  notifications: { likes: true, comments: true, follows: true },
};

// Immutable deep-set by dot-path: 'privacy.showEmail' -> { privacy: { showEmail } }.
const setByPath = (obj, path, value) => {
  const keys = String(path).split(".");
  const next = { ...obj };
  let cursor = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
};

const getByPath = (obj, path) =>
  String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);

const applyTheme = (theme) => {
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", isDark);
};

const applyFontSize = (size) => {
  const root = document.documentElement;
  for (const cls of FONT_SIZE_CLASSES) root.classList.remove(cls);
  root.classList.add(FONT_SIZE_TO_CLASS[size] || FONT_SIZE_TO_CLASS.md);
};

const applyReduceMotion = (enabled) => {
  document.documentElement.classList.toggle("motion-reduce-forced", !!enabled);
};

const applyCompactMode = (enabled) => {
  document.documentElement.classList.toggle("compact-mode", !!enabled);
};

export function PreferencesProvider({ children }) {
  const { user, updateUser } = useAuth();

  const preferences = useMemo(
    () => ({
      ...DEFAULT_PREFERENCES,
      ...(user?.preferences || {}),
      privacy: {
        ...DEFAULT_PREFERENCES.privacy,
        ...(user?.preferences?.privacy || {}),
      },
      notifications: {
        ...DEFAULT_PREFERENCES.notifications,
        ...(user?.preferences?.notifications || {}),
      },
    }),
    [user]
  );

  const { theme, fontSize, reduceMotion, compactMode } = preferences;

  useEffect(() => {
    applyTheme(theme);

    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    applyFontSize(fontSize);
  }, [fontSize]);

  useEffect(() => {
    applyReduceMotion(reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    applyCompactMode(compactMode);
  }, [compactMode]);

  const updatePreference = useCallback(
    async (path, value) => {
      if (!user) return;

      const previous = user.preferences || DEFAULT_PREFERENCES;
      const next = setByPath(previous, path, value);

      updateUser({ preferences: next });

      try {
        const data = await userService.updateProfile({ preferences: next });
        if (data?.user?.preferences) {
          updateUser({ preferences: data.user.preferences });
        }
      } catch (err) {
        updateUser({ preferences: previous });
        throw err;
      }
    },
    [user, updateUser]
  );

  const getPreference = useCallback(
    (path) => getByPath(preferences, path),
    [preferences]
  );

  const value = useMemo(
    () => ({ preferences, theme, updatePreference, getPreference }),
    [preferences, theme, updatePreference, getPreference]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
