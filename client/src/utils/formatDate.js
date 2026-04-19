import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const toDate = (input) => {
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);
  if (typeof input === "string") {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

/**
 * formatRelative — short relative time for feed/post cards.
 * Within 7 days: "5m", "3h", "2d". Past that, falls back to short
 * absolute (`"Mar 14"` or `"Mar 14, 2025"` if a different year).
 */
export function formatRelative(input) {
  const date = toDate(input);
  if (!date) return "";
  const diff = Date.now() - date.getTime();

  if (Math.abs(diff) < SEVEN_DAYS_MS) {
    return formatDistanceToNowStrict(date, {
      locale: enUS,
      addSuffix: false,
    })
      .replace(/\s?seconds?$/, "s")
      .replace(/\s?minutes?$/, "m")
      .replace(/\s?hours?$/, "h")
      .replace(/\s?days?$/, "d");
  }

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? "MMM d" : "MMM d, yyyy", { locale: enUS });
}

/**
 * formatAbsolute — full readable timestamp used as Tooltip content
 * over a relative timestamp on cards.
 */
export function formatAbsolute(input) {
  const date = toDate(input);
  if (!date) return "";
  return format(date, "MMM d, yyyy · HH:mm", { locale: enUS });
}

/**
 * formatDateTime — explicit machine-readable for `<time dateTime>`.
 */
export function toIso(input) {
  const date = toDate(input);
  return date ? date.toISOString() : "";
}

export default formatRelative;
