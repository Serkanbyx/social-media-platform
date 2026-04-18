import { cn } from "../../utils/cn.js";

/**
 * Divider — horizontal rule used between settings sections, between the
 * dropdown's menu groups, and (with `label`) as an "OR" separator on
 * auth screens.
 *
 * Decorative by default — accessible name is omitted because the visual
 * line carries no semantic weight.
 */
export default function Divider({ label, className = "" }) {
  if (label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={cn(
          "relative flex items-center py-2 text-2xs uppercase tracking-wide text-zinc-500",
          className
        )}
      >
        <span className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
        <span className="px-3">{label}</span>
        <span className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
      </div>
    );
  }

  return (
    <hr
      className={cn(
        "border-0 border-t border-zinc-200 dark:border-zinc-800",
        className
      )}
    />
  );
}
