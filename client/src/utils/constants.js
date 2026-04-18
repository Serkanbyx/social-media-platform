/**
 * Shared client constants.
 *
 * Pagination defaults mirror the server-side clamps in
 * `server/middleware/pagination.js` so the client never asks for a page size
 * the API will silently reject. Keeping them in one place avoids "magic
 * number" drift between services and components.
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;

export const FEED_PAGE_LIMIT = 20;
export const EXPLORE_PAGE_LIMIT = 24;
export const COMMENTS_PAGE_LIMIT = 20;
export const NOTIFICATIONS_PAGE_LIMIT = 20;
export const FOLLOW_LIST_PAGE_LIMIT = 24;

export const SEARCH_DEBOUNCE_MS = 300;

export const TOKEN_STORAGE_KEY = "token";
export const THEME_STORAGE_KEY = "pulse:theme";
export const FONT_SIZE_STORAGE_KEY = "pulse:font-size";

/**
 * Clamp a requested limit into the [1, MAX_PAGE_LIMIT] range so a stray
 * `Infinity` or negative value can't reach the network layer.
 */
export const clampLimit = (n, fallback = DEFAULT_PAGE_LIMIT) => {
  const value = Number.isFinite(n) ? Math.trunc(n) : fallback;
  if (value < 1) return 1;
  if (value > MAX_PAGE_LIMIT) return MAX_PAGE_LIMIT;
  return value;
};
