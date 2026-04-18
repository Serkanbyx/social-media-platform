import { useRef } from "react";
import { cn } from "../../utils/cn.js";

/**
 * SegmentedControl — pill row of mutually exclusive options.
 *
 * Used by Settings (Theme: light/dark/system, Font size: S/M/L). Behaves
 * like a `radiogroup`: arrow keys move selection without leaving the
 * group.
 */
export default function SegmentedControl({
  options = [],
  value,
  onChange,
  ariaLabel,
  size = "md",
  className = "",
}) {
  const buttonsRef = useRef([]);

  const handleKeyDown = (event, idx) => {
    const last = options.length - 1;
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = idx === last ? 0 : idx + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = idx === 0 ? last : idx - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = last;
    }
    if (next === null) return;
    event.preventDefault();
    onChange?.(options[next].value);
    buttonsRef.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800",
        className
      )}
    >
      {options.map((option, idx) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonsRef.current[idx] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange?.(option.value)}
            onKeyDown={(event) => handleKeyDown(event, idx)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-fast",
              size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-sm",
              selected
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
            )}
          >
            {option.icon && (
              <option.icon className="size-3.5" aria-hidden="true" />
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
