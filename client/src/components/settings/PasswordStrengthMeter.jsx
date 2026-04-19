import { STRENGTH_COLORS, STRENGTH_LABELS } from "../../utils/passwordStrength.js";

/**
 * PasswordStrengthMeter — five-segment bar + microcopy under a password
 * field. Driven entirely by a precomputed `score` so the parent stays
 * responsible for choosing how the score is calculated (typically via
 * `scorePassword` from `utils/passwordStrength.js`).
 */
export default function PasswordStrengthMeter({ score = 0 }) {
  const colorClass = STRENGTH_COLORS[score] ?? STRENGTH_COLORS[0];
  const filled = Math.max(score, 0);

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={[
              "h-1.5 flex-1 rounded-full transition-colors duration-fast",
              i < filled ? colorClass : "bg-zinc-200 dark:bg-zinc-800",
            ].join(" ")}
          />
        ))}
      </div>
      <p
        className="mt-1 text-2xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        aria-live="polite"
      >
        Şifre gücü: {STRENGTH_LABELS[score] ?? STRENGTH_LABELS[0]}
      </p>
    </div>
  );
}
