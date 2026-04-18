import { cn } from "../../utils/cn.js";

/**
 * CharacterCounter — inline counter shown next to text inputs in the
 * post composer, comment composer, and profile bio editor.
 *
 * Color shifts as the user approaches and crosses the limit, using the
 * same semantic palette as Banner: muted under 80%, warning between
 * 80–99%, danger at and above 100%. The element is `aria-live="polite"`
 * so screen readers announce when the limit is exceeded without
 * interrupting typing.
 */
export default function CharacterCounter({ value = "", max, className = "" }) {
  const length =
    typeof value === "string" ? value.length : Number(value) || 0;
  const ratio = max > 0 ? length / max : 0;

  const tone =
    ratio >= 1
      ? "text-rose-600 font-semibold dark:text-rose-400"
      : ratio >= 0.8
        ? "text-amber-600 dark:text-amber-400"
        : "text-zinc-500 dark:text-zinc-400";

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("text-2xs tnum text-right", tone, className)}
    >
      {length}
      {max ? ` / ${max}` : ""}
    </span>
  );
}
