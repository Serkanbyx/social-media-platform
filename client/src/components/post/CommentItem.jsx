import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Trash2 } from "lucide-react";

import Avatar from "../ui/Avatar.jsx";
import ConfirmModal from "../ui/ConfirmModal.jsx";
import Dropdown from "../ui/Dropdown.jsx";
import IconButton from "../ui/IconButton.jsx";
import Tooltip from "../ui/Tooltip.jsx";

import { useAuth } from "../../context/useAuth.js";

import * as commentService from "../../services/commentService.js";

import { cn } from "../../utils/cn.js";
import {
  formatAbsolute,
  formatRelative,
  toIso,
} from "../../utils/formatDate.js";
import { notify } from "../../utils/notify.js";

/**
 * CommentItem — single comment row used by PostDetailPage (STEP 30).
 *
 * Layout: small avatar + identity row (name + @username + relative time) +
 * the comment body (whitespace-preserving so paragraphs survive). A
 * three-dot dropdown only renders when the viewer can actually delete
 * the comment (author / post author / admin) so non-actionable users
 * don't see a dead menu.
 *
 * Delete flow is optimistic: once the API call succeeds we play a brief
 * shrink-out animation, then notify the parent via `onDelete(id)` so it
 * can drop the row from its list and decrement its local counter. On
 * failure we revert the removing state and surface a toast — the server
 * is the source of truth, never the optimistic UI.
 *
 * The whole row is *not* a single anchor — name/username/avatar each
 * link to the author profile individually so we don't nest `<a>`
 * elements inside one another.
 */
function CommentItem({ comment, postAuthorId, onDelete, className = "" }) {
  const { user } = useAuth();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const author = comment?.author || {};
  const username = author.username || "user";
  const profileHref = `/u/${username}`;

  const canDelete = useMemo(() => {
    if (!user) return false;
    if (user.role === "admin") return true;
    const viewerId = String(user._id);
    if (String(author._id || "") === viewerId) return true;
    if (postAuthorId && String(postAuthorId) === viewerId) return true;
    return false;
  }, [author._id, postAuthorId, user]);

  const createdIso = toIso(comment?.createdAt);
  const createdRelative = formatRelative(comment?.createdAt);
  const createdAbsolute = formatAbsolute(comment?.createdAt);

  const commentId = comment?._id;
  const handleDeleteConfirm = useCallback(async () => {
    if (!commentId) return;
    try {
      await commentService.deleteComment(commentId);
      setConfirmOpen(false);
      setRemoving(true);
      window.setTimeout(() => onDelete?.(commentId), 200);
      notify.success("Yorum silindi.");
    } catch {
      setRemoving(false);
      setConfirmOpen(false);
      notify.error("Yorum silinemedi.");
    }
  }, [commentId, onDelete]);

  const menuItems = useMemo(
    () => [
      {
        key: "delete",
        label: "Yorumu sil",
        icon: Trash2,
        danger: true,
        onClick: () => setConfirmOpen(true),
      },
    ],
    []
  );

  if (!comment) return null;

  return (
    <>
      <li
        aria-busy={removing || undefined}
        className={cn(
          "group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors duration-fast",
          "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50",
          removing && "motion-safe:animate-shrink-out",
          className
        )}
      >
        <Link
          to={profileHref}
          className="shrink-0 rounded-full"
          aria-label={`@${username} profili`}
        >
          <Avatar
            src={author.avatar?.url}
            name={author.name}
            username={author.username}
            size="sm"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5 text-sm">
            <Link
              to={profileHref}
              className="truncate font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
            >
              {author.name || `@${username}`}
            </Link>
            {author.name && (
              <Link
                to={profileHref}
                className="truncate text-zinc-500 hover:underline dark:text-zinc-400"
              >
                @{username}
              </Link>
            )}
            <span aria-hidden="true" className="text-zinc-400">
              ·
            </span>
            <Tooltip content={createdAbsolute}>
              <time
                dateTime={createdIso}
                className="shrink-0 text-zinc-500 tabular-nums dark:text-zinc-400"
              >
                {createdRelative}
              </time>
            </Tooltip>
          </div>

          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-100">
            {comment.content}
          </p>
        </div>

        {canDelete && (
          <div
            className={cn(
              "shrink-0 transition-opacity duration-fast",
              "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            )}
          >
            <Dropdown
              trigger={
                <IconButton
                  icon={MoreHorizontal}
                  aria-label="Yorum menüsü"
                  variant="ghost"
                  size="sm"
                />
              }
              items={menuItems}
              align="end"
              width="w-44"
            />
          </div>
        )}
      </li>

      <ConfirmModal
        open={confirmOpen}
        title="Yorumu sil"
        description="Bu yorumu silmek üzeresin. Bu işlem geri alınamaz."
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        busyLabel="Siliniyor…"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

export default memo(CommentItem);
