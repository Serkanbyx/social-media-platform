import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Bell } from "lucide-react";

import Avatar from "../ui/Avatar.jsx";
import Popover from "../ui/Popover.jsx";
import { cn } from "../../utils/cn.js";
import { formatRelative } from "../../utils/formatDate.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { useSocket } from "../../context/SocketContext.jsx";
import {
  linkForNotification,
  sentenceFor,
  useNotifications,
} from "../../context/useNotifications.js";

/**
 * NotificationBell — bell icon + unread badge for the top navigation.
 *
 * Composition rationale:
 *  - On mobile (<md) the bell behaves like a tab: clicking it always
 *    navigates straight to `/notifications`. There is no room for a
 *    popover, and the dedicated bottom-tab link already exists for
 *    parallel navigation.
 *  - On desktop the bell opens a `Popover` with a mini-list (last 5
 *    items) plus "Mark all as read" / "See all" links. This shaves a
 *    full page navigation off the most common "what's new" check.
 *  - The badge is `aria-live="polite"` so screen-reader users are
 *    notified when the count changes without stealing focus.
 *  - Wiggle animation is keyed off `pulseKey` from the context so we
 *    don't have to re-subscribe to the socket here. Each bump replays
 *    the animation cleanly (key change re-mounts the icon span).
 */

const ACTIVE_TRIGGER =
  "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300";
const IDLE_TRIGGER =
  "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

function UnreadBadge({ count }) {
  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-2xs font-semibold text-white tnum ring-2 ring-white empty:hidden dark:ring-zinc-950"
      style={{ height: "1rem" }}
    >
      {count > 0 ? (count > 9 ? "9+" : count) : ""}
    </span>
  );
}

function BellIcon({ pulseKey }) {
  return (
    <span
      key={pulseKey}
      className={cn(
        "relative inline-flex",
        pulseKey > 0 && "motion-safe:animate-wiggle"
      )}
    >
      <Bell className="size-5" aria-hidden="true" />
    </span>
  );
}

function ConnectionDot() {
  const { socket } = useSocket();
  const [showDot, setShowDot] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!socket) return undefined;

    const onDisconnect = () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setShowDot(true), 5000);
    };
    const onConnect = () => {
      window.clearTimeout(timerRef.current);
      setShowDot(false);
    };

    if (socket.connected === false) onDisconnect();

    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);

    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
      window.clearTimeout(timerRef.current);
    };
  }, [socket]);

  if (!showDot) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-2xs text-zinc-500"
      role="status"
    >
      <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
      Bağlanılıyor…
    </span>
  );
}

function MiniListItem({ notification, onClose }) {
  const sender = notification.sender || {};
  const senderName = sender.name || sender.username || "Birisi";
  return (
    <li>
      <Link
        to={linkForNotification(notification)}
        onClick={onClose}
        className={cn(
          "flex items-start gap-2.5 px-3 py-2.5 transition-colors duration-fast",
          notification.isRead
            ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            : "bg-brand-50/60 hover:bg-brand-50 dark:bg-brand-950/30 dark:hover:bg-brand-950/40"
        )}
      >
        <Avatar
          src={sender.avatar}
          name={sender.name}
          username={sender.username}
          size="sm"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">
            <span className="font-semibold">{senderName}</span>{" "}
            <span className="text-zinc-700 dark:text-zinc-300">
              {sentenceFor(notification.type)}
            </span>
          </span>
          <span className="mt-0.5 block text-2xs text-zinc-500 tnum">
            {formatRelative(notification.createdAt)}
          </span>
        </span>
      </Link>
    </li>
  );
}

function PopoverContent({ onClose }) {
  const { items, unreadCount, loading, loadMore, markAllRead } =
    useNotifications();

  // Lazy-load the first page when the popover opens for the first time
  // so the mini-list isn't empty after a fresh login.
  useEffect(() => {
    if (items.length === 0 && !loading) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = items.slice(0, 5);

  return (
    <div className="flex w-80 flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Bildirimler
        </span>
        <div className="flex items-center gap-2">
          <ConnectionDot />
          <button
            type="button"
            onClick={() => {
              markAllRead().catch(() => {});
            }}
            disabled={unreadCount === 0}
            className="text-2xs font-medium text-brand-700 transition-colors duration-fast hover:text-brand-800 disabled:cursor-not-allowed disabled:text-zinc-400 dark:text-brand-300 dark:hover:text-brand-200 dark:disabled:text-zinc-600"
          >
            Tümünü okundu işaretle
          </button>
        </div>
      </header>

      {loading && preview.length === 0 ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="skeleton size-8 rounded-full" />
              <span className="flex-1 space-y-1.5">
                <span className="skeleton block h-3 w-2/3" />
                <span className="skeleton block h-3 w-1/3" />
              </span>
            </li>
          ))}
        </ul>
      ) : preview.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-zinc-500">
          Henüz bir bildirimin yok.
        </p>
      ) : (
        <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
          {preview.map((n) => (
            <MiniListItem
              key={n._id}
              notification={n}
              onClose={onClose}
            />
          ))}
        </ul>
      )}

      <Link
        to="/notifications"
        onClick={onClose}
        className="border-t border-zinc-100 px-3 py-2.5 text-center text-xs font-medium text-brand-700 transition-colors duration-fast hover:bg-brand-50 dark:border-zinc-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
      >
        Tümünü gör
      </Link>
    </div>
  );
}

export default function NotificationBell() {
  const { unreadCount, pulseKey } = useNotifications();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const ariaLabel = unreadCount
    ? `Bildirimler, ${unreadCount} okunmamış`
    : "Bildirimler";

  if (isMobile) {
    return (
      <NavLink
        to="/notifications"
        aria-label={ariaLabel}
        className={({ isActive }) =>
          cn(
            "relative inline-flex size-9 items-center justify-center rounded-full transition-colors duration-fast",
            isActive ? ACTIVE_TRIGGER : IDLE_TRIGGER
          )
        }
      >
        <BellIcon pulseKey={pulseKey} />
        <UnreadBadge count={unreadCount} />
      </NavLink>
    );
  }

  return (
    <Popover
      align="end"
      width="w-auto"
      panelClassName="!w-auto p-0"
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "relative inline-flex size-9 items-center justify-center rounded-full transition-colors duration-fast",
            IDLE_TRIGGER
          )}
        >
          <BellIcon pulseKey={pulseKey} />
          <UnreadBadge count={unreadCount} />
        </button>
      }
    >
      {({ close }) => <PopoverContent onClose={close} />}
    </Popover>
  );
}
