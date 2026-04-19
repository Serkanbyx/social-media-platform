import { Fragment, useEffect, useMemo, useRef } from "react";
import { Bell } from "lucide-react";

import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import NotificationItem from "../../components/notification/NotificationItem.jsx";
import { NotificationItemSkeleton } from "../../components/ui/skeletons";
import Spinner from "../../components/ui/Spinner.jsx";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll.js";
import { useNotifications } from "../../context/useNotifications.js";
import { notify } from "../../utils/notify.js";

/**
 * NotificationsPage — full-page list of the viewer's notifications.
 *
 * UX notes:
 *  - We delay the auto mark-all-read by 1.5s so the user has a moment
 *    to register what's new before the highlight backgrounds fade.
 *    The unread visual cue persists for the page session via the
 *    `wasInitiallyUnread` snapshot inside `NotificationItem`.
 *  - Items are grouped by relative age (Today / Yesterday / This week /
 *    Earlier) for quick scanning of long lists. Group dividers are
 *    cheap (computed memos) and never block the initial render.
 *  - Cursor pagination is delegated to the context; this page only
 *    wires an `IntersectionObserver` sentinel to trigger `loadMore`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const groupKeyFor = (input) => {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "earlier";
  const today = startOfToday();
  const ts = date.getTime();
  if (ts >= today) return "today";
  if (ts >= today - DAY_MS) return "yesterday";
  if (ts >= today - 7 * DAY_MS) return "thisWeek";
  return "earlier";
};

const GROUP_LABELS = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  earlier: "Earlier",
};

const GROUP_ORDER = ["today", "yesterday", "thisWeek", "earlier"];

export default function NotificationsPage() {
  useDocumentTitle("Notifications");

  const {
    items,
    unreadCount,
    loading,
    hasMore,
    loadMore,
    markAllRead,
  } = useNotifications();

  const autoMarkFiredRef = useRef(false);

  // Kick off the very first page on mount. The context dedupes against
  // any items already loaded by the navbar popover.
  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shortly after items first arrive, mark everything read in the
  // background so the navbar/tab badge clears as soon as the user
  // lands on the page. The 400ms delay lets the highlighted "unread"
  // background paint at least one frame so users still get a visual
  // cue for what's new (the per-item `wasInitiallyUnread` snapshot
  // keeps that highlight pinned for the rest of the page session).
  useEffect(() => {
    if (autoMarkFiredRef.current) return undefined;
    if (loading) return undefined;
    if (items.length === 0) return undefined;
    if (unreadCount === 0) {
      autoMarkFiredRef.current = true;
      return undefined;
    }

    const handle = window.setTimeout(() => {
      autoMarkFiredRef.current = true;
      markAllRead().catch(() => {});
    }, 400);

    return () => window.clearTimeout(handle);
  }, [items.length, loading, unreadCount, markAllRead]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    loading,
    onLoadMore: loadMore,
  });

  const grouped = useMemo(() => {
    const buckets = { today: [], yesterday: [], thisWeek: [], earlier: [] };
    for (const n of items) {
      const key = groupKeyFor(n.createdAt);
      buckets[key].push(n);
    }
    return GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
      key,
      label: GROUP_LABELS[key],
      items: buckets[key],
    }));
  }, [items]);

  const handleMarkAll = async () => {
    try {
      await markAllRead();
    } catch {
      notify.error("Couldn't update notifications.");
    }
  };

  const showInitialSkeleton = loading && items.length === 0;
  const showEmpty = !loading && items.length === 0;

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Notifications
        </h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleMarkAll}
          disabled={unreadCount === 0}
        >
          Mark all as read
        </Button>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {showInitialSkeleton ? (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <NotificationItemSkeleton key={i} />
            ))}
          </ul>
        ) : showEmpty ? (
          <EmptyState
            icon={Bell}
            title="All caught up"
            description="You don't have any notifications yet."
          />
        ) : (
          <>
            {grouped.map((group, groupIdx) => (
              <Fragment key={group.key}>
                <h2
                  className={`${
                    groupIdx === 0 ? "rounded-t-xl" : ""
                  } border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-2xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400`}
                >
                  {group.label}
                </h2>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {group.items.map((n) => (
                    <NotificationItem key={n._id} notification={n} />
                  ))}
                </ul>
              </Fragment>
            ))}

            {loading && items.length > 0 && (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            )}

            {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}

            {!hasMore && items.length > 0 && (
              <p className="py-4 text-center text-2xs text-zinc-400">
                You&apos;ve reached the end of the list.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
