import { useId } from "react";
import { cn } from "../../utils/cn.js";

/**
 * SettingsSection — shared card scaffold used by every settings page.
 *
 * Pattern: a rounded card with a heading row (title + optional
 * description) above a divider, followed by free-form content. Centralising
 * the surface keeps the four pages visually identical and frees them up to
 * focus on their domain controls.
 *
 * `<h2>` is used for the title so the page outline stays meaningful — the
 * page header (rendered by `SettingsLayout`) is the only `<h1>` on screen.
 */
export default function SettingsSection({
  title,
  description,
  action,
  children,
  className = "",
  contentClassName = "",
}) {
  const reactId = useId();
  const headingId = `settings-section-${reactId}`;
  const descId = description ? `${headingId}-desc` : undefined;

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descId}
      className={cn(
        "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
    >
      <header className="flex items-start gap-3 px-5 pb-4 pt-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2
            id={headingId}
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {title}
          </h2>
          {description && (
            <p
              id={descId}
              className="mt-1 text-sm text-zinc-500 dark:text-zinc-400"
            >
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      <div className="border-t border-zinc-100 dark:border-zinc-800/80" />

      <div className={cn("px-5 py-5 sm:px-6", contentClassName)}>{children}</div>
    </section>
  );
}
