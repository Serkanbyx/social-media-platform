import { useCallback, useEffect, useMemo, useState } from "react";

import * as authService from "../services/authService.js";
import { TOKEN_STORAGE_KEY } from "../utils/constants.js";
import { AuthContext } from "./useAuth.js";

/**
 * AuthContext — single source of truth for the signed-in user.
 *
 * Design notes:
 *  - The JWT lives in `localStorage` (read once on mount, then mirrored to
 *    state) so a hard refresh keeps the session alive without an extra
 *    network round-trip just to know "am I logged in?".
 *  - `loading` starts `true` whenever a token is found at boot so route
 *    guards can render a spinner instead of flashing the public layout
 *    before `getMe()` resolves.
 *  - The axios interceptor (`api/axios.js`) already handles 401 -> redirect;
 *    here we just mirror that by clearing local state on a failed `getMe`,
 *    so the UI doesn't keep stale data after a revoked/expired token.
 */

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    // No token = nothing to bootstrap. `user`/`loading` are already in
    // the right shape via initial state, and `logout` / the catch branch
    // below clear them on the way out, so we don't need a redundant
    // setState here (which would also trip the cascading-render rule).
    if (!token) return undefined;

    // `loading` already starts `true` when a token exists at boot
    // (see initial state). After login/register, `user` is set from the
    // response, so we intentionally don't flip `loading` back to true
    // during the background re-validation — avoids a spinner flash on
    // route guards while getMe runs.
    let cancelled = false;

    authService
      .getMe()
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const data = await authService.login({ email, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(data.user);
    setToken(data.token);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authService.register(payload);
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(data.user);
    setToken(data.token);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const isAdmin = useCallback(() => user?.role === "admin", [user]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      updateUser,
      isAdmin,
    }),
    [user, token, loading, login, register, logout, updateUser, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
