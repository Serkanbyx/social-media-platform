import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

import Avatar from "../ui/Avatar.jsx";
import IconButton from "../ui/IconButton.jsx";
import Tooltip from "../ui/Tooltip.jsx";
import { cn } from "../../utils/cn.js";
import { cldUrl } from "../../utils/cldUrl.js";
import { formatAbsolute, formatRelative, toIso } from "../../utils/formatDate.js";
import {
  linkForNotification,
  sentenceFor,
  useNotifications,
} from "../../context/NotificationContext.jsx";
import { notify } from "../../utils/notify.js";

/**
 * NotificationItem — single row inside the notifications list.
 *
 * Behaviour notes:
 *  - Clicking anywhere on the row navigates to the relevant target and
 *    flips the unread flag in one go. The delete `IconButton` lives on
 *    top with `stopPropagation` so its click never leaks into the row.
 *  - `wasInitiallyUnread` is captured on mount and persists for the
 *    component's lifetime so the highlighted background sticks even
 *    after the auto mark-all-read fires — the user keeps a visual
 *    anchor for "what was new this visit" until they navigate away.
 *  - Delete is optimistic with revert handled by the context. The
 *    shrink-out animation runs locally before the parent unmounts the
 *    row so the removal feels physical rather than abrupt.
 */
export default function NotificationItem({ notification }) {
  const navigate = useNavigate();
  const { markRead, removeNotification } = useNotifications();

  const [wasInitiallyUnread] = useState(() => !notification.isRead);
  const [isLeaving, setIsLeaving] = useState(false);

  const sender = notification.sender || {};
  const senderName = sender.name || sender.username || "Birisi";
  const target = linkForNotification(notification);
  const showThumbnail =
    (notification.type === "like" || notification.type === "comment") &&
    notification.post?.image;

  const onActivate = () => {
    if (isLeaving) return;
    if (!notification.isRead) {
      markRead(notification._id).catch(() => {
        notify.error("Bildirim güncellenemedi.");
      });
    }
    navigate(target);
  };

  const onDelete = async (event) => {
    event.stopPropagation();
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      // Wait for the leave animation before asking the parent to drop the
      // row from the list — keeps the motion uninterrupted.
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      await removeNotification(notification._id);
    } catch {
      setIsLeaving(false);
      notify.error("Bildirim silinemedi.");
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };

  return (
    <li
      className={cn(
        "group/item",
        isLeaving && "animate-shrink-out pointer-events-none"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onActivate}
        onKeyDown={onKeyDown}
        aria-label={`${senderName} ${sentenceFor(notification.type)}`}
        className={cn(
          "relative flex w-full cursor-pointer items-start gap-3 px-4 py-3 transition-colors duration-fast",
          wasInitiallyUnread
            ? "bg-brand-50/60 dark:bg-brand-950/30"
            : "bg-transparent",
          wasInitiallyUnread &&
            "border-l-2 border-brand-500 dark:border-brand-400",
          "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
        )}
      >
        <Avatar
          src={sender.avatar}
          name={sender.name}
          username={sender.username}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-900 dark:text-zinc-100">
            <span className="font-semibold">{senderName}</span>{" "}
            <span className="text-zinc-700 dark:text-zinc-300">
              {sentenceFor(notification.type)}
            </span>
          </p>
          {notification.type !== "follow" && notification.post?.content && (
            <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
              “{notification.post.content}”
            </p>
          )}
          <Tooltip content={formatAbsolute(notification.createdAt)}>
            <time
              dateTime={toIso(notification.createdAt)}
              className="mt-1 inline-block text-2xs text-zinc-500 tnum"
            >
              {formatRelative(notification.createdAt)}
            </time>
          </Tooltip>
        </div>

        {showThumbnail && (
          <img
            src={cldUrl(notification.post.image, {
              w: 80,
              h: 80,
              c: "fill",
              q: "auto",
              f: "auto",
            })}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-12 shrink-0 rounded-md object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
          />
        )}

        <IconButton
          as="span"
          role="button"
          tabIndex={0}
          icon={X}
          size="sm"
          variant="ghost"
          aria-label="Bildirimi sil"
          onClick={onDelete}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onDelete(event);
            }
          }}
          className="opacity-0 transition-opacity duration-fast group-hover/item:opacity-100 focus-visible:opacity-100"
        />

        {!notification.isRead && (
          <span
            aria-hidden="true"
            className="absolute right-3 top-3 size-2 rounded-full bg-brand-600 dark:bg-brand-400"
          />
        )}
      </div>
    </li>
  );
}
