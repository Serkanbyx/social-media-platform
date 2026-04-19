import { useId } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "../../utils/cn.js";

/**
 * AdminSelect — small native `<select>` styled to match the admin
 * filters / row-action language. Uses the native control on purpose:
 * mobile gets the system picker for free and keyboard semantics are
 * already correct.
 *
 * `inline` collapses the label into a visually-hidden span (used inside
 * filter rows where the placeholder text on the trigger is enough).
 */
export default function AdminSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
  inline = false,
  className = "",
}) {
  const reactId = useId();
  const selectId = id || `adm-sel-${reactId}`;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label &&
        (inline ? (
          <label htmlFor={selectId} className="sr-only">
            {label}
          </label>
        ) : (
          <label
            htmlFor={selectId}
            className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            {label}
          </label>
        ))}
      <span className="relative inline-flex">
        <select
          id={selectId}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
          className={cn(
            "h-9 appearance-none rounded-md border border-zinc-200 bg-white pl-3 pr-8 text-sm text-zinc-700 transition-colors duration-fast",
            "focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
            "dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          aria-hidden="true"
        />
      </span>
    </div>
  );
}
