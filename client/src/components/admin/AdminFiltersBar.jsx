import { Search, X } from "lucide-react";

import IconButton from "../ui/IconButton.jsx";
import Input from "../ui/Input.jsx";
import Spinner from "../ui/Spinner.jsx";

/**
 * AdminFiltersBar — shared header row used by every admin list.
 *
 * Provides:
 *  - debounced search input (parent owns the value + debouncing)
 *  - flexible "extras" slot for dropdowns / status pills / etc.
 *  - "Filtreleri sıfırla" ghost button when at least one filter is active
 *
 * Kept dumb on purpose: the parent decides what counts as "active" and
 * how to reset; this component just lays the row out consistently and
 * shows the small inline spinner while the debounce is pending.
 */
export default function AdminFiltersBar({
  search,
  onSearchChange,
  searchPlaceholder = "Ara…",
  searchPending = false,
  hasActiveFilters = false,
  onReset,
  extras,
  searchAriaLabel,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel || searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
          maxLength={30}
          leftAddon={<Search className="size-4" aria-hidden="true" />}
          rightAddon={
            searchPending ? (
              <Spinner size="sm" />
            ) : search ? (
              <IconButton
                icon={X}
                size="sm"
                variant="ghost"
                aria-label="Aramayı temizle"
                onClick={() => onSearchChange?.("")}
              />
            ) : null
          }
        />
      </div>

      {extras && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {extras}
        </div>
      )}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className="shrink-0 self-start rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors duration-fast hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:self-auto"
        >
          Filtreleri sıfırla
        </button>
      )}
    </div>
  );
}
