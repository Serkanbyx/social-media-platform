import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * PasswordInput — text input with a toggleable show/hide eye button.
 *
 * Notes:
 *  - Default `type="password"` so password managers and browser autofill
 *    behave correctly even before the user interacts with the toggle.
 *  - The toggle button is keyboard-reachable and exposes `aria-pressed`
 *    so assistive tech announces the current visibility state.
 *  - Errors are wired through `aria-invalid` + `aria-describedby` so the
 *    Login/Register forms can render inline messages without extra glue.
 */
const PasswordInput = forwardRef(function PasswordInput(
  {
    id,
    name = "password",
    label,
    helperText,
    errorText,
    autoComplete = "current-password",
    placeholder,
    value,
    onChange,
    onBlur,
    required = false,
    autoFocus = false,
    className = "",
  },
  ref
) {
  const reactId = useId();
  const inputId = id || `pw-${reactId}`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;

  const describedBy = [errorText ? errorId : null, helperText ? helperId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          aria-invalid={errorText ? "true" : undefined}
          aria-describedby={describedBy}
          className={[
            "block w-full rounded-md border bg-white py-2.5 pl-3 pr-10 text-sm text-zinc-900 shadow-xs transition-colors duration-fast",
            "placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none",
            "dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-brand-400",
            errorText
              ? "border-rose-300 dark:border-rose-800"
              : "border-zinc-200 dark:border-zinc-800",
          ].join(" ")}
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
          aria-pressed={visible}
          aria-controls={inputId}
          tabIndex={0}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-zinc-500 transition-colors duration-fast hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ToggleIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      {helperText && !errorText && (
        <p
          id={helperId}
          className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400"
        >
          {helperText}
        </p>
      )}

      {errorText && (
        <p
          id={errorId}
          className="mt-1.5 text-xs text-rose-600 dark:text-rose-400"
        >
          {errorText}
        </p>
      )}
    </div>
  );
});

export default PasswordInput;
