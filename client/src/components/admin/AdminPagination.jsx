import { ChevronLeft, ChevronRight } from "lucide-react";

import Button from "../ui/Button.jsx";

/**
 * AdminPagination — compact page-based footer used by every admin list
 * (users, posts, comments).
 *
 * Renders nothing while there's only one page so the empty state and
 * single-page tables don't carry useless chrome. Prev / Next reflect
 * `loading` so a moderator can't queue up a stack of paged requests.
 */
export default function AdminPagination({
  page,
  totalPages,
  total,
  loading = false,
  onPageChange,
}) {
  if (!totalPages || totalPages <= 1) return null;

  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  return (
    <nav
      aria-label="Sayfalama"
      className="flex flex-col items-center justify-between gap-3 border-t border-zinc-200 px-1 pt-4 sm:flex-row dark:border-zinc-800"
    >
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Toplam <span className="font-semibold tnum text-zinc-700 dark:text-zinc-200">{total}</span> kayıt ·{" "}
        Sayfa <span className="font-semibold tnum text-zinc-700 dark:text-zinc-200">{page}</span> / {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={ChevronLeft}
          disabled={!canPrev}
          onClick={() => onPageChange?.(page - 1)}
        >
          Önceki
        </Button>
        <Button
          variant="secondary"
          size="sm"
          rightIcon={ChevronRight}
          disabled={!canNext}
          onClick={() => onPageChange?.(page + 1)}
        >
          Sonraki
        </Button>
      </div>
    </nav>
  );
}
