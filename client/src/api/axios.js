import axios from "axios";

import { TOKEN_STORAGE_KEY } from "../utils/constants.js";

/**
 * Axios instance used by every service in `src/services/*`.
 *
 * Security model (mirrors STEPS.md / STEP 21):
 *  - JWT lives in localStorage and is attached only via the `Authorization`
 *    header — never as a cookie — so this app has zero CSRF surface.
 *  - `withCredentials` is intentionally NOT set: we use bearer tokens.
 *  - The base URL is read from `VITE_API_URL` so production builds never
 *    ship a hard-coded localhost (see `client/.env.example`).
 *  - 401 responses trigger a single, debounced auto-logout + redirect so a
 *    stale or revoked token can't keep the UI in a half-authenticated state.
 */

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL && import.meta.env.DEV) {
  // Loud warning in dev only — production builds with a missing env var
  // should fail at build time via the deployment pipeline, not at runtime.
  console.warn(
    "[axios] VITE_API_URL is not defined. Copy client/.env.example to .env and restart Vite."
  );
}

const api = axios.create({
  baseURL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRedirecting = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);

      const onAuthPage =
        window.location.pathname.startsWith("/login") ||
        window.location.pathname.startsWith("/register");

      if (!onAuthPage && !isRedirecting) {
        isRedirecting = true;
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
