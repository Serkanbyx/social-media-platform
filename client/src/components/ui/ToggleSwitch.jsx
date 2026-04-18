import { useId } from "react";
import { cn } from "../../utils/cn.js";

/**
 * ToggleSwitch — accessible boolean switch built on top of a native
 * checkbox so it works inside `<form>` submissions and password
 * managers without extra wiring.
 *
 * The visible track / thumb live in spans; the real `<input>` is
 * visually hidden but stays in the tab order so keyboard and assistive
 * tech behave correctly.
 */
export default function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled = false,
  label,
  description,
  className = "",
  name,
}) {
  const reactId = useId();
  const inputId = id || `toggle-${reactId}`;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex items-start gap-3",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input
          id={inputId}
          name={name}
          type="checkbox"
          role="switch"
          aria-checked={!!checked}
          checked={!!checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked, event)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "h-6 w-11 rounded-full bg-zinc-200 transition-colors duration-base dark:bg-zinc-700",
            "peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white",
            "dark:peer-focus-visible:ring-offset-zinc-950"
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-base",
            "peer-checked:translate-x-5"
          )}
        />
      </span>

      {(label || description) && (
        <span className="min-w-0 flex-1">
          {label && (
            <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {label}
            </span>
          )}
          {description && (
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
