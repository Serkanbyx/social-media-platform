import { format, formatDistanceToNowStrict } from "date-fns";
import { tr } from "date-fns/locale";

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
 * Within 7 days: "5dk", "3sa", "2g". Past that, falls back to short
 * absolute (`"14 Mar"` or `"14 Mar 2025"` if a different year).
 */
export function formatRelative(input) {
  const date = toDate(input);
  if (!date) return "";
  const diff = Date.now() - date.getTime();

  if (Math.abs(diff) < SEVEN_DAYS_MS) {
    return formatDistanceToNowStrict(date, {
      locale: tr,
      addSuffix: false,
    })
      .replace("saniye", "sn")
      .replace("dakika", "dk")
      .replace("saat", "sa")
      .replace("gün", "g");
  }

  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? "d MMM" : "d MMM yyyy", { locale: tr });
}

/**
 * formatAbsolute — full readable timestamp used as Tooltip content
 * over a relative timestamp on cards.
 */
export function formatAbsolute(input) {
  const date = toDate(input);
  if (!date) return "";
  return format(date, "d MMM yyyy · HH:mm", { locale: tr });
}

/**
 * formatDateTime — explicit machine-readable for `<time dateTime>`.
 */
export function toIso(input) {
  const date = toDate(input);
  return date ? date.toISOString() : "";
}

export default formatRelative;
