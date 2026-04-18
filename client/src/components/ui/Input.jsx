import { forwardRef, useId } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Input — generic text input with label, helper, error and addon slots.
 *
 * Auto-generates an `id` so callers don't have to thread one in just to
 * wire up the label. Errors are surfaced through `aria-invalid` and
 * `aria-describedby` so assistive tech announces them on focus.
 *
 * `leftAddon` / `rightAddon` accept any node (e.g. an icon, an `@`
 * prefix, or a clear/eye toggle button).
 */
const Input = forwardRef(function Input(
  {
    id,
    type = "text",
    label,
    helper,
    error,
    leftAddon,
    rightAddon,
    className = "",
    inputClassName = "",
    required = false,
    ...rest
  },
  ref
) {
  const reactId = useId();
  const inputId = id || `inp-${reactId}`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  const describedBy = [
    error ? errorId : null,
    !error && helper ? helperId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const wrapperClasses = cn(
    "relative flex items-stretch rounded-md border bg-white shadow-xs transition-colors duration-fast",
    "dark:bg-zinc-950",
    error
      ? "border-rose-300 focus-within:border-rose-500 dark:border-rose-800"
      : "border-zinc-200 focus-within:border-brand-500 dark:border-zinc-800 dark:focus-within:border-brand-400"
  );

  const inputClasses = cn(
    "block w-full bg-transparent px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none",
    "h-10 dark:text-zinc-100 dark:placeholder:text-zinc-500",
    leftAddon && "pl-1.5",
    rightAddon && "pr-1.5",
    inputClassName
  );

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}

      <div className={wrapperClasses}>
        {leftAddon && (
          <span className="flex items-center pl-3 text-sm text-zinc-400">
            {leftAddon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          required={required}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={inputClasses}
          {...rest}
        />
        {rightAddon && (
          <span className="flex items-center pr-2 text-sm text-zinc-400">
            {rightAddon}
          </span>
        )}
      </div>

      {!error && helper && (
        <p id={helperId} className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
