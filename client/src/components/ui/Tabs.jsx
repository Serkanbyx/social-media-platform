import { useId, useRef } from "react";
import { cn } from "../../utils/cn.js";
import Badge from "./Badge.jsx";

/**
 * Tabs — controlled underline-style tab list.
 *
 * Tabs are ARIA-compliant: arrow keys move focus across the row, Home
 * and End jump to the ends, and the consumer is responsible for
 * rendering the matching `<TabPanel>` content alongside.
 */
export default function Tabs({
  tabs = [],
  value,
  onChange,
  ariaLabel = "Sekmeler",
  className = "",
}) {
  const reactId = useId();
  const tabsRef = useRef([]);

  const handleKeyDown = (event, idx) => {
    const last = tabs.length - 1;
    let next = null;
    if (event.key === "ArrowRight") next = idx === last ? 0 : idx + 1;
    else if (event.key === "ArrowLeft") next = idx === 0 ? last : idx - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    onChange?.(tabs[next].id);
    tabsRef.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800",
        className
      )}
    >
      {tabs.map((tab, idx) => {
        const selected = tab.id === value;
        const tabId = `${reactId}-${tab.id}`;
        const panelId = `${reactId}-${tab.id}-panel`;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabsRef.current[idx] = node;
            }}
            id={tabId}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange?.(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, idx)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-2.5 pt-2 text-sm font-medium transition-colors duration-fast",
              selected
                ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            )}
          >
            {tab.icon && <tab.icon className="size-4" aria-hidden="true" />}
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <Badge size="sm" variant={selected ? "brand" : "default"}>
                {tab.count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
