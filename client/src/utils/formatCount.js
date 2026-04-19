/**
 * compactCount — short numeric label for like/comment/follower counts.
 *
 * Uses `Intl.NumberFormat` with the `en` locale so the compact suffixes
 * stay consistent with the rest of the English UI (e.g. `1.2K`, `3.4M`).
 * Falls back to a manual implementation on the off chance the runtime
 * doesn't support `notation: "compact"`.
 */
const compactFormatter =
  typeof Intl !== "undefined"
    ? new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
      })
    : null;

export function compactCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  if (compactFormatter) return compactFormatter.format(num);

  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs < 1000) return `${sign}${abs}`;
  if (abs < 1_000_000) return `${sign}${(abs / 1000).toFixed(1)}K`;
  if (abs < 1_000_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
}

/**
 * pluralize — `${compactCount(value)} ${singular|plural}`.
 *
 * English-only pluralization helper that pairs a compact count with the
 * correct word form ("1 follower" vs "2 followers"). Pass an explicit
 * `plural` for irregular nouns; otherwise we default to `${singular}s`.
 */
export function pluralize(value, singular, plural) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  const word = safe === 1 ? singular : plural || `${singular}s`;
  return `${compactCount(safe)} ${word}`;
}

export default compactCount;
