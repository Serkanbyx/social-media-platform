import { cn } from "../../utils/cn.js";

/**
 * Badge — small pill used for counts, status labels, tags.
 *
 * Variants map to the same semantic palette as Banner (info / success /
 * warning / danger / brand) so cross-component visuals stay consistent.
 */
const VARIANTS = {
  default:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  brand:
    "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  danger:
    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  info:
    "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
};

const SIZES = {
  sm: "h-5 px-2 text-2xs",
  md: "h-6 px-2.5 text-xs",
};

export default function Badge({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...rest
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium leading-none tnum",
        SIZES[size] || SIZES.md,
        VARIANTS[variant] || VARIANTS.default,
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
