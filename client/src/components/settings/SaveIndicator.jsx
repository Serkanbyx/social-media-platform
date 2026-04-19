import { Check } from "lucide-react";
import { cn } from "../../utils/cn.js";

/**
 * SaveIndicator — tiny "Saved" microcopy + checkmark used by the
 * auto-saving controls (toggles and segmented selectors). It fades in
 * for ~1.5 s after a successful preference write and stays out of the
 * tab order. The `aria-live` region announces "Saved" once for screen
 * reader users.
 *
 * Visibility is purely CSS-driven so toggling the parent's state from
 * `false` to `true` (and back) gives a buttery 180 ms crossfade without
 * any timers in this component.
 */
export default function SaveIndicator({
  visible,
  label = "Kaydedildi",
  className = "",
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none inline-flex items-center gap-1 text-2xs font-medium text-emerald-600 transition-opacity duration-base dark:text-emerald-400",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      <Check className="size-3.5" aria-hidden="true" />
      <span>{visible ? label : ""}</span>
    </span>
  );
}
