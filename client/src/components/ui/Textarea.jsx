import { forwardRef, useId, useRef } from "react";
import { useAutoResizeTextarea } from "../../hooks/useAutoResizeTextarea.js";
import { cn } from "../../utils/cn.js";

/**
 * Textarea — controlled multi-line input matching `Input`'s contract.
 *
 * Optional `autoResize` grows the textarea with content via
 * `useAutoResizeTextarea` — the post composer relies on this so the
 * field never feels cramped while still capping at a max height.
 */
const Textarea = forwardRef(function Textarea(
  {
    id,
    label,
    helper,
    error,
    className = "",
    textareaClassName = "",
    autoResize = false,
    maxHeight = 280,
    rows = 3,
    value,
    required = false,
    ...rest
  },
  forwardedRef
) {
  const reactId = useId();
  const localRef = useRef(null);
  const setRef = (node) => {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  useAutoResizeTextarea(autoResize ? localRef : { current: null }, value, {
    maxHeight,
  });

  const textareaId = id || `txt-${reactId}`;
  const helperId = `${textareaId}-helper`;
  const errorId = `${textareaId}-error`;

  const describedBy = [
    error ? errorId : null,
    !error && helper ? helperId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={textareaId}
          className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
        >
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}

      <textarea
        ref={setRef}
        id={textareaId}
        rows={rows}
        value={value}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className={cn(
          "block w-full min-h-[88px] resize-none rounded-md border bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-xs",
          "placeholder:text-zinc-400 outline-none transition-colors duration-fast",
          "dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500",
          error
            ? "border-rose-300 focus:border-rose-500 dark:border-rose-800"
            : "border-zinc-200 focus:border-brand-500 dark:border-zinc-800 dark:focus:border-brand-400",
          textareaClassName
        )}
        {...rest}
      />

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

export default Textarea;
