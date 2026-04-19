import { createContext, useContext } from "react";

/**
 * Auth context object + `useAuth` hook live here (separate from the
 * `<AuthProvider>` component file) so React's Fast Refresh can keep
 * working — the rule requires component files to *only* export
 * components.
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return ctx;
}
