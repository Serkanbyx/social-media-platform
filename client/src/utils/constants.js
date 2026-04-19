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

// Per-surface page sizes — kept identical to the server-side defaults in
// the matching validators so the client sends the same number the API
// would have applied anyway. Adjust both sides together if these move.
//   - feed:           server default 10, max 20  (feedValidator)
//   - explore/posts:  server default 12, max 30  (postValidator)
//   - comments:       server default 20, max 50  (commentValidator)
//   - notifications:  server default 20, max 50  (notificationValidator)
//   - follow lists:   server default 20, max 50  (userValidator)
export const FEED_PAGE_LIMIT = 10;
export const EXPLORE_PAGE_LIMIT = 12;
export const COMMENTS_PAGE_LIMIT = 20;
export const NOTIFICATIONS_PAGE_LIMIT = 20;
export const FOLLOW_LIST_PAGE_LIMIT = 20;

export const SEARCH_DEBOUNCE_MS = 300;

export const TOKEN_STORAGE_KEY = "token";
export const THEME_STORAGE_KEY = "pulse:theme";
export const FONT_SIZE_STORAGE_KEY = "pulse:font-size";

/* ----------------------------------------------------------------------
 * Content limits — mirrored on the server in the relevant validators so
 * the UI can show counters and prevent the obvious 400s before they leave
 * the browser. Update both sides if any of these values move.
 * --------------------------------------------------------------------*/
export const MAX_POST_CONTENT = 1000;
export const MAX_BIO = 200;
export const MAX_USERNAME = 20;
export const MAX_NAME = 50;
export const MAX_COMMENT = 500;

/* ----------------------------------------------------------------------
 * Upload limits & accepted MIME types — used by avatar/composer file
 * pickers and the attachment picker.
 * --------------------------------------------------------------------*/
export const MAX_AVATAR_MB = 5;
export const MAX_POST_IMAGE_MB = 5;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

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
