import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import * as notificationService from "../services/notificationService.js";
import Avatar from "../components/ui/Avatar.jsx";
import { formatRelative } from "../utils/formatDate.js";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { useAuth } from "./useAuth.js";
import { useSocket } from "./SocketContext.jsx";
import {
  NotificationContext,
  linkForNotification,
  sentenceFor,
} from "./useNotifications.js";

/**
 * NotificationContext — owns the notification list, unread badge and the
 * realtime stream that updates them.
 *
 * Design notes:
 *  - `unreadCount` has two writers: the optimistic local mutations and the
 *    authoritative `notification:unread-count` socket event. The socket
 *    event always wins (it's the server's truth) so we recover from any
 *    optimistic drift after a failed mutation.
 *  - List items use cursor-based pagination matching the REST contract
 *    (`hasMore` + `nextCursor`); `loadMore()` is idempotent — it bails
 *    early when already loading or when no more pages exist.
 *  - Real-time toasts are suppressed when the viewer is already on the
 *    Notifications page (the page itself is the live UI) or when the tab
 *    is hidden (we update the document title instead so the browser tab
 *    badge does the talking).
 *  - On logout we wipe state aggressively so a second user logging in on
 *    the same browser session never sees a flash of the previous user's
 *    notifications.
 */

// Cap for concurrent stacked toasts so a thundering-herd of new
// notifications doesn't bury the rest of the UI.
const MAX_TOAST_STACK = 3;

// Tab-title prefix regex — matches the "(N) " we add and only that, so
// repeated applies stay idempotent.
const TITLE_PREFIX_RE = /^\(\d+\)\s/;

// Notifications include populated refs; reject anything that doesn't at
// least look like the documented shape. Defensive against malformed
// socket payloads from a future server bug.
const isValidNotification = (value) =>
  value &&
  typeof value === "object" &&
  typeof value._id === "string" &&
  typeof value.type === "string" &&
  value.sender &&
  typeof value.sender === "object";

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  // Bumped on every incoming `notification:new` so consumers (the bell)
  // can react without re-subscribing to the socket themselves.
  const [pulseKey, setPulseKey] = useState(0);

  const initialised = useRef(false);
  // Keep refs to the latest location/viewport so the socket effect can
  // read them without re-subscribing whenever the route changes.
  const onNotificationsPageRef = useRef(false);
  const isMobileRef = useRef(isMobile);
  const activeToastsRef = useRef([]);

  useEffect(() => {
    onNotificationsPageRef.current = location.pathname === "/notifications";
  }, [location.pathname]);

  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // Reset on logout / user switch so we don't leak state between
  // sessions. State resets are done during render via the
  // "store-previous-prop" pattern — React's recommended alternative to a
  // setState-in-effect cascade. Side effects (dismissing toasts, ref
  // bookkeeping) still belong in an effect.
  const [prevUserId, setPrevUserId] = useState(user?._id ?? null);
  const currentUserId = user?._id ?? null;
  if (prevUserId !== currentUserId) {
    setPrevUserId(currentUserId);
    if (!currentUserId) {
      setItems([]);
      setUnreadCount(0);
      setHasMore(true);
      setNextCursor(null);
    }
  }

  useEffect(() => {
    if (user) return;
    initialised.current = false;
    activeToastsRef.current.forEach((id) => toast.dismiss(id));
    activeToastsRef.current = [];
  }, [user]);

  // Lightweight badge fetch on auth — kept separate from the list query so
  // the navbar bell can render without paying for the full first page.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    notificationService
      .getUnreadCount()
      .then((data) => {
        if (!cancelled) setUnreadCount(data.count ?? 0);
      })
      .catch(() => {
        // Silent — the badge will sync via the next socket event anyway.
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Whenever the tab regains focus, resync the unread badge from the
  // server. The user might have read notifications in another tab/device.
  useEffect(() => {
    if (!user) return undefined;
    const onVisible = () => {
      if (document.hidden) return;
      notificationService
        .getUnreadCount()
        .then((data) => setUnreadCount(data.count ?? 0))
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user]);

  // Update the tab title with an unread-count prefix while the document
  // is hidden, so the browser tab badge advertises the new activity.
  // Strips the prefix on re-focus and on cleanup so per-page titles set
  // via `useDocumentTitle` are preserved.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const apply = () => {
      const stripped = document.title.replace(TITLE_PREFIX_RE, "");
      if (document.hidden && unreadCount > 0) {
        document.title = `(${unreadCount}) ${stripped}`;
      } else {
        document.title = stripped;
      }
    };

    apply();
    document.addEventListener("visibilitychange", apply);
    return () => {
      document.removeEventListener("visibilitychange", apply);
      document.title = document.title.replace(TITLE_PREFIX_RE, "");
    };
  }, [unreadCount]);

  // Realtime subscriptions. Handlers are stable references inside this
  // effect so React can correctly remove them when the socket changes.
  useEffect(() => {
    if (!socket) return undefined;

    const showToast = (notification) => {
      // Don't double up on UI noise: the page itself is the live list.
      if (onNotificationsPageRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;

      // Hard cap on concurrently-visible toasts. Drop the oldest before
      // pushing the new one so the user sees the most recent activity.
      if (activeToastsRef.current.length >= MAX_TOAST_STACK) {
        const drop = activeToastsRef.current.shift();
        if (drop) toast.dismiss(drop);
      }

      const toastId = `notif-${notification._id}`;
      activeToastsRef.current.push(toastId);

      const onClickToast = () => {
        toast.dismiss(toastId);
        navigate(linkForNotification(notification));
      };

      toast.custom(
        (t) => (
          <button
            type="button"
            onClick={onClickToast}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-white p-3 text-left shadow-md ring-1 ring-zinc-200 transition-transform duration-fast motion-safe:hover:scale-[1.01] dark:bg-zinc-900 dark:ring-zinc-800 ${
              t.visible ? "animate-toast-in" : "opacity-0"
            }`}
            aria-label={`Bildirim: ${
              notification.sender?.name || notification.sender?.username || "Birisi"
            } ${sentenceFor(notification.type)}`}
          >
            <Avatar
              src={notification.sender?.avatar}
              name={notification.sender?.name}
              username={notification.sender?.username}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">
                <span className="font-semibold">
                  {notification.sender?.name || notification.sender?.username || "Birisi"}
                </span>{" "}
                {sentenceFor(notification.type)}
              </span>
              <span className="mt-0.5 block text-2xs text-zinc-500">
                {formatRelative(notification.createdAt) || "şimdi"}
              </span>
            </span>
          </button>
        ),
        {
          id: toastId,
          duration: 4000,
          position: isMobileRef.current ? "top-center" : "bottom-right",
        }
      );

      // Sweep the active list on dismissal so the cap stays accurate.
      window.setTimeout(() => {
        activeToastsRef.current = activeToastsRef.current.filter(
          (id) => id !== toastId
        );
      }, 4200);
    };

    const handleNew = (notification) => {
      if (!isValidNotification(notification)) return;

      setItems((prev) => {
        if (prev.some((n) => n._id === notification._id)) return prev;
        return [notification, ...prev];
      });
      setUnreadCount((c) => c + 1);
      setPulseKey((k) => k + 1);
      showToast(notification);
    };

    const handleCount = ({ count } = {}) => {
      setUnreadCount(Number.isFinite(count) ? count : 0);
    };

    // After a reconnect the server is the source of truth — refetch the
    // unread badge so we recover from any events missed while offline.
    const handleReconnect = () => {
      notificationService
        .getUnreadCount()
        .then((data) => setUnreadCount(data.count ?? 0))
        .catch(() => {});
    };

    socket.on("notification:new", handleNew);
    socket.on("notification:unread-count", handleCount);
    socket.on("connect", handleReconnect);

    return () => {
      socket.off("notification:new", handleNew);
      socket.off("notification:unread-count", handleCount);
      socket.off("connect", handleReconnect);
    };
  }, [socket, navigate]);

  const loadMore = useCallback(async () => {
    if (loading) return;
    if (initialised.current && !hasMore) return;

    setLoading(true);
    try {
      const data = await notificationService.listNotifications({
        cursor: nextCursor || undefined,
      });
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n._id));
        const incoming = (data.items || []).filter((n) => !seen.has(n._id));
        return [...prev, ...incoming];
      });
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor || null);
      initialised.current = true;
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, nextCursor]);

  const markRead = useCallback(async (id) => {
    let wasUnread = false;
    setItems((prev) =>
      prev.map((n) => {
        if (n._id !== id) return n;
        if (!n.isRead) wasUnread = true;
        return { ...n, isRead: true };
      })
    );
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await notificationService.markRead(id);
    } catch (err) {
      // Roll back the optimistic flip on failure.
      setItems((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: false } : n))
      );
      if (wasUnread) setUnreadCount((c) => c + 1);
      throw err;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    let snapshotItems;
    let snapshotCount;
    setItems((prev) => {
      snapshotItems = prev;
      return prev.map((n) => (n.isRead ? n : { ...n, isRead: true }));
    });
    setUnreadCount((c) => {
      snapshotCount = c;
      return 0;
    });

    try {
      await notificationService.markAllRead();
    } catch (err) {
      if (snapshotItems) setItems(snapshotItems);
      if (snapshotCount !== undefined) setUnreadCount(snapshotCount);
      throw err;
    }
  }, []);

  const removeNotification = useCallback(async (id) => {
    let snapshotItems;
    let snapshotCount;
    let wasUnread = false;
    setItems((prev) => {
      snapshotItems = prev;
      const removed = prev.find((n) => n._id === id);
      wasUnread = Boolean(removed && !removed.isRead);
      return prev.filter((n) => n._id !== id);
    });
    if (wasUnread) {
      setUnreadCount((c) => {
        snapshotCount = c;
        return Math.max(0, c - 1);
      });
    }

    try {
      await notificationService.deleteNotification(id);
    } catch (err) {
      if (snapshotItems) setItems(snapshotItems);
      if (snapshotCount !== undefined) setUnreadCount(snapshotCount);
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      hasMore,
      nextCursor,
      pulseKey,
      loadMore,
      markRead,
      markAllRead,
      removeNotification,
      linkForNotification,
    }),
    [
      items,
      unreadCount,
      loading,
      hasMore,
      nextCursor,
      pulseKey,
      loadMore,
      markRead,
      markAllRead,
      removeNotification,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
