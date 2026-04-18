import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";

import * as notificationService from "../services/notificationService.js";
import { useAuth } from "./AuthContext.jsx";
import { useSocket } from "./SocketContext.jsx";

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
 *  - On logout we wipe state aggressively so a second user logging in on
 *    the same browser session never sees a flash of the previous user's
 *    notifications.
 */

const NotificationContext = createContext(null);

const TYPE_SENTENCE = {
  like: "gönderini beğendi",
  comment: "gönderine yorum yaptı",
  follow: "seni takip etmeye başladı",
};

const sentenceFor = (type) => TYPE_SENTENCE[type] || "yeni bir bildirim gönderdi";

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);

  const initialised = useRef(false);

  // Reset on logout / user switch so we don't leak state between sessions.
  useEffect(() => {
    if (user) return;
    setItems([]);
    setUnreadCount(0);
    setHasMore(true);
    setNextCursor(null);
    initialised.current = false;
  }, [user]);

  // Lightweight badge fetch on auth — kept separate from the list query so
  // the navbar bell can render without paying for the full first page.
  useEffect(() => {
    if (!user) return;
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

  // Realtime subscriptions. The handlers are stable references inside this
  // effect so React can correctly remove them when the socket changes.
  useEffect(() => {
    if (!socket) return undefined;

    const handleNew = (notification) => {
      setItems((prev) => {
        if (prev.some((n) => n._id === notification._id)) return prev;
        return [notification, ...prev];
      });
      setUnreadCount((c) => c + 1);

      const sender =
        notification.sender?.name || notification.sender?.username || "Birisi";
      toast.success(`${sender} ${sentenceFor(notification.type)}`);
    };

    const handleCount = ({ count }) => {
      setUnreadCount(Number.isFinite(count) ? count : 0);
    };

    socket.on("notification:new", handleNew);
    socket.on("notification:unread-count", handleCount);

    return () => {
      socket.off("notification:new", handleNew);
      socket.off("notification:unread-count", handleCount);
    };
  }, [socket]);

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

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      hasMore,
      nextCursor,
      loadMore,
      markRead,
      markAllRead,
    }),
    [
      items,
      unreadCount,
      loading,
      hasMore,
      nextCursor,
      loadMore,
      markRead,
      markAllRead,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider."
    );
  }
  return ctx;
}
