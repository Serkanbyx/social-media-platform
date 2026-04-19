import { Loader2 } from "lucide-react";

/**
 * Spinner — single source of truth for "we're loading something".
 *
 * Two presentations:
 *  - Inline (default): drop into buttons, lists, cards.
 *  - `fullScreen`: centered viewport-fill, used by route guards while
 *    the auth/me check resolves to avoid a flash of the wrong layout.
 */
export default function Spinner({
  size = "md",
  fullScreen = false,
  label = "Loading",
  className = "",
}) {
  const sizeClass =
    size === "sm" ? "size-4" : size === "lg" ? "size-8" : "size-5";

  const icon = (
    <Loader2
      className={`${sizeClass} animate-spin text-brand-600 dark:text-brand-400 ${className}`}
      aria-hidden="true"
    />
  );

  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm dark:bg-zinc-950/60"
      >
        {icon}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <span role="status" aria-live="polite" className="inline-flex items-center">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
