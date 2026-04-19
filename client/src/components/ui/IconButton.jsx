import { forwardRef } from "react";
import Spinner from "./Spinner.jsx";
import { cn } from "../../utils/cn.js";

/**
 * IconButton — square button for icon-only actions (post menu, like,
 * comment trigger, navbar search trigger, etc.). Always requires
 * `aria-label` for screen-reader users since there is no visible text.
 */
const SIZES = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
};

const ICON_SIZES = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

const VARIANTS = {
  ghost:
    "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
  filled:
    "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
  danger:
    "bg-transparent text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40",
  brand:
    "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/40",
};

const IconButton = forwardRef(function IconButton(
  {
    as: Component = "button",
    type,
    icon: Icon,
    children,
    "aria-label": ariaLabel,
    variant = "ghost",
    size = "md",
    loading = false,
    disabled = false,
    className = "",
    ...rest
  },
  ref
) {
  if (import.meta.env?.DEV && !ariaLabel) {
     
    console.warn("[IconButton] aria-label is required for icon-only buttons.");
  }

  const isNativeButton = Component === "button";
  const isInteractiveDisabled = disabled || loading;

  const classes = cn(
    "inline-flex items-center justify-center rounded-full transition-colors duration-fast",
    "focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none",
    SIZES[size] || SIZES.md,
    VARIANTS[variant] || VARIANTS.ghost,
    className
  );

  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;
  const content = loading ? (
    <Spinner size={size === "lg" ? "md" : "sm"} />
  ) : Icon ? (
    <Icon className={iconSize} aria-hidden="true" />
  ) : (
    children
  );

  return (
    <Component
      ref={ref}
      type={isNativeButton ? type || "button" : undefined}
      disabled={isNativeButton ? isInteractiveDisabled : undefined}
      aria-disabled={!isNativeButton && isInteractiveDisabled ? true : undefined}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {content}
    </Component>
  );
});

export default IconButton;
