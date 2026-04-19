import { Check } from "lucide-react";
import { cn } from "../../utils/cn.js";

/**
 * SelectableCard — large clickable card used in Settings (Theme picker,
 * profile visibility selector). Behaves like a single radio option in a
 * larger group; the parent should render multiple SelectableCards
 * inside a `role="radiogroup"`.
 *
 * Renders as a button so it's keyboard-reachable and announces itself
 * as a radio via `role="radio"` + `aria-checked`.
 */
export default function SelectableCard({
  selected = false,
  onSelect,
  icon: Icon,
  title,
  description,
  ariaLabel,
  disabled = false,
  className = "",
  children,
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onSelect?.()}
      className={cn(
        "group relative flex w-full flex-col rounded-xl border p-4 text-left transition-all duration-fast",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/30 dark:bg-brand-950/40"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60",
        className
      )}
    >
      <span className="flex w-full items-start gap-3">
        {Icon && (
          <span
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-fast",
              selected
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              {description}
            </span>
          )}
        </span>

        {selected && (
          <Check
            className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-300"
            aria-hidden="true"
          />
        )}
      </span>

      {children}
    </button>
  );
}
