import { forwardRef } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Card — base surface for PostCard, settings panels, profile headers.
 *
 * Three padding presets cover most use cases. `interactive` adds a
 * subtle hover shadow used when the whole card is clickable (e.g.
 * search result rows). Render as any element via `as` — useful when a
 * card is itself a `<Link>` or `<button>`.
 */
const PADDINGS = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const Card = forwardRef(function Card(
  {
    as: Component = "div",
    padding = "md",
    interactive = false,
    className = "",
    children,
    ...rest
  },
  ref
) {
  return (
    <Component
      ref={ref}
      className={cn(
        "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
        PADDINGS[padding] ?? PADDINGS.md,
        interactive &&
          "transition-shadow duration-fast hover:shadow-xs focus-visible:shadow-xs",
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
});

export default Card;
