import { createContext, useContext } from "react";

/**
 * Preferences context object + `usePreferences` hook live here (separate
 * from the `<PreferencesProvider>` component file) so React's Fast
 * Refresh can keep working — the rule requires component files to
 * *only* export components.
 */
export const PreferencesContext = createContext(null);

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider.");
  }
  return ctx;
}
