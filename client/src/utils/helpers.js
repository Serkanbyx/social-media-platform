/**
 * Small utility helpers shared across components.
 *
 * Kept dependency-free on purpose: every function here is pure and
 * cheap so it's safe to call inside renders without memoisation.
 */

/**
 * hashStringToHue — deterministic 0–359 hue derived from a string.
 * Used by Avatar to pick a fallback color that stays stable for the
 * same user across sessions.
 */
export function hashStringToHue(value) {
  const seed = String(value || "");
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

/**
 * getInitials — returns 1–2 uppercase initials from a name. Falls back
 * to the first character of the username, then to "?".
 */
export function getInitials(nameOrUsername, fallback = "?") {
  const trimmed = String(nameOrUsername || "").trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * truncate — clamp a string to `max` chars and append a single ellipsis.
 * Returns the original string when shorter than the limit.
 */
export function truncate(value, max = 80) {
  const str = String(value ?? "");
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * uniqueById — dedupe an array of `{ _id }` (or `{ id }`) shaped items
 * while preserving order. Used by paginated lists when the server might
 * return overlapping items between pages.
 */
export function uniqueById(items = [], key = "_id") {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const id = item?.[key] ?? item?.id;
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

/**
 * sleep — small async helper for awaiting a transition or animation.
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
