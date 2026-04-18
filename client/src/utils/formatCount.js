/**
 * compactCount — short numeric label for like/comment/follower counts.
 *
 * Uses `Intl.NumberFormat` for proper i18n (Turkish ondalık ayracı `,`
 * — 1,2 B yerine 1.2 B beklemiyoruz; Türkçe için "B" / "Mn" tercih
 * edilir). Falls back to a manual implementation on the off chance the
 * runtime doesn't support `notation: "compact"`.
 */
const compactFormatter =
  typeof Intl !== "undefined"
    ? new Intl.NumberFormat("tr-TR", {
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
  if (abs < 1_000_000) return `${sign}${(abs / 1000).toFixed(1)}B`;
  if (abs < 1_000_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}Mn`;
  return `${sign}${(abs / 1_000_000_000).toFixed(1)}Mr`;
}

export default compactCount;
