/**
 * passwordStrength — scoring used by Register and AccountSettings so the
 * meter behaves identically in both places.
 *
 * Score 0–5 mirrors the server validator
 * (`server/validators/authValidator.js`) plus two UX bonuses (symbol,
 * length ≥ 12) that reward stronger inputs without lying about the
 * minimum requirement.
 */
export const STRENGTH_LABELS = [
  "Very weak",
  "Weak",
  "Fair",
  "Good",
  "Strong",
  "Very strong",
];

export const STRENGTH_COLORS = [
  "bg-zinc-200 dark:bg-zinc-800",
  "bg-rose-500",
  "bg-amber-500",
  "bg-amber-400",
  "bg-emerald-500",
  "bg-emerald-600",
];

export function scorePassword(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Za-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return score;
}

export function isStrongEnough(pw) {
  return (
    typeof pw === "string" &&
    pw.length >= 8 &&
    /[A-Za-z]/.test(pw) &&
    /\d/.test(pw)
  );
}
