import { cn } from "../../utils/cn.js";

/**
 * CharacterCounter — inline counter shown next to text inputs in the
 * post composer, comment composer, and profile bio editor.
 *
 * Color shifts as the user approaches and crosses the limit, using the
 * same semantic palette as Banner: muted under 80%, warning between
 * 80–99%, danger at and above 100%.
 *
 * `live` toggles the polite announcement. Defaults to `true`; the post
 * composer flips it on only above ~80% so screen readers don't read
 * every keystroke. When `live` is false the element is rendered as a
 * plain `<span>` (no `role`/`aria-live`) and stays silent.
 */
export default function CharacterCounter({
  value = "",
  max,
  live = true,
  className = "",
}) {
  const length =
    typeof value === "string" ? value.length : Number(value) || 0;
  const ratio = max > 0 ? length / max : 0;

  const tone =
    ratio >= 1
      ? "text-rose-600 font-semibold dark:text-rose-400"
      : ratio >= 0.8
        ? "text-amber-600 dark:text-amber-400"
        : "text-zinc-500 dark:text-zinc-400";

  const liveProps = live
    ? { role: "status", "aria-live": "polite" }
    : { "aria-hidden": "true" };

  return (
    <span
      {...liveProps}
      className={cn("text-2xs tnum text-right", tone, className)}
    >
      {length}
      {max ? ` / ${max}` : ""}
    </span>
  );
}
