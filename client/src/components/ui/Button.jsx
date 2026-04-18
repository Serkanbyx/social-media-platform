import { forwardRef } from "react";
import Spinner from "./Spinner.jsx";
import { cn } from "../../utils/cn.js";

/**
 * Button — the most-used primitive in the app.
 *
 * Single source of truth for button visuals so feed actions, settings
 * forms and admin tables all share the same hover/focus/disabled
 * contract.
 *
 * Polymorphic via `as` (defaults to a native `<button>`). When rendered
 * as a link (`as="a"` or a `react-router` `Link`) we drop the `type`
 * attribute and respect a `disabled` prop with `aria-disabled` so
 * keyboard navigation still feels right.
 */
const VARIANTS = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400 motion-safe:active:scale-[0.98] shadow-xs",
  secondary:
    "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700",
  ghost:
    "bg-transparent text-zinc-700 hover:bg-zinc-100/70 dark:text-zinc-200 dark:hover:bg-zinc-800/70",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-400 motion-safe:active:scale-[0.98] shadow-xs",
  link:
    "bg-transparent text-brand-700 hover:text-brand-800 hover:underline underline-offset-4 dark:text-brand-300 dark:hover:text-brand-200 px-0",
};

const SIZES = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-fast " +
  "focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";

const Button = forwardRef(function Button(
  {
    as: Component = "button",
    type,
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    fullWidth = false,
    className = "",
    children,
    ...rest
  },
  ref
) {
  const isNativeButton = Component === "button";
  const isInteractiveDisabled = disabled || loading;

  const classes = cn(
    BASE,
    SIZES[size] || SIZES.md,
    VARIANTS[variant] || VARIANTS.primary,
    fullWidth && "w-full",
    className
  );

  const content = (
    <>
      {loading ? (
        <Spinner size="sm" />
      ) : (
        LeftIcon && <LeftIcon className="size-4" aria-hidden="true" />
      )}
      {children && <span className="truncate">{children}</span>}
      {!loading && RightIcon && (
        <RightIcon className="size-4" aria-hidden="true" />
      )}
    </>
  );

  return (
    <Component
      ref={ref}
      type={isNativeButton ? type || "button" : undefined}
      disabled={isNativeButton ? isInteractiveDisabled : undefined}
      aria-disabled={!isNativeButton && isInteractiveDisabled ? true : undefined}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {content}
    </Component>
  );
});

export default Button;
