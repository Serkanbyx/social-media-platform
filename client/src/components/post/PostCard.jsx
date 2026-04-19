import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart,
  ImageOff,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Trash2,
} from "lucide-react";

import Avatar from "../ui/Avatar.jsx";
import ConfirmModal from "../ui/ConfirmModal.jsx";
import Dropdown from "../ui/Dropdown.jsx";
import IconButton from "../ui/IconButton.jsx";
import Tooltip from "../ui/Tooltip.jsx";

import { useAuth } from "../../context/useAuth.js";

import { cldUrl } from "../../utils/cldUrl.js";
import { cn } from "../../utils/cn.js";
import compactCount, { pluralize } from "../../utils/formatCount.js";
import {
  formatAbsolute,
  formatRelative,
  toIso,
} from "../../utils/formatDate.js";
import { truncate } from "../../utils/helpers.js";
import { tokenize } from "../../utils/linkify.js";
import { notify } from "../../utils/notify.js";
import * as postService from "../../services/postService.js";

/**
 * PostCard — atomic unit of the timeline (STEP 26).
 *
 * Renders a single post with header (avatar + identity + menu), body
 * (linkified text + optional image), and an action row (like / comment /
 * share). Three layout variants:
 *
 *  - `feed`     (default): full card, body clamped, used in lists.
 *  - `detail`  : no clamp, larger image, verbose action labels.
 *  - `compact` : sm avatar, no image, used in admin tables / search rows.
 *
 * Like is fully optimistic with concurrency-safe state: extra clicks
 * during the in-flight request are ignored, and the local count snaps
 * back to the server number on failure. Delete is gated behind
 * `ConfirmModal`; once the request resolves the card animates out and
 * the parent's `onDelete(id)` is invoked.
 *
 * The whole card is intentionally NOT a single anchor — that would nest
 * `<a>` elements and break keyboard navigation. Specific subelements
 * (avatar, name, image, comment count) link individually.
 */

const VARIANT = {
  feed: "feed",
  detail: "detail",
  compact: "compact",
};

const HORIZONTAL_RATIO_THRESHOLD = 1.2;

const renderTokens = (tokens) =>
  tokens.map((token, idx) => {
    const key = `${token.type}-${idx}`;
    switch (token.type) {
      case "mention":
        return (
          <Link
            key={key}
            to={`/u/${token.username}`}
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {token.value}
          </Link>
        );
      case "hashtag":
        return (
          <Link
            key={key}
            to={`/explore?q=${encodeURIComponent(token.value)}`}
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {token.value}
          </Link>
        );
      case "url":
        return (
          <a
            key={key}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 break-all hover:underline dark:text-brand-400"
          >
            {token.value}
          </a>
        );
      default:
        return <span key={key}>{token.value}</span>;
    }
  });

function PostCard({
  post,
  onLikeToggle,
  onDelete,
  variant = VARIANT.feed,
  priority = false,
  className = "",
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isDetail = variant === VARIANT.detail;
  const isCompact = variant === VARIANT.compact;

  const author = post?.author || {};
  const username = author.username || "user";
  const profileHref = `/u/${username}`;
  const postHref = `/posts/${post?._id}`;

  const [liked, setLiked] = useState(() => {
    if (!user || !Array.isArray(post?.likes)) return false;
    const viewerId = String(user._id);
    return post.likes.some((id) => String(id) === viewerId);
  });
  const [likesCount, setLikesCount] = useState(post?.likesCount ?? 0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [popping, setPopping] = useState(false);
  const popTimerRef = useRef(null);

  const [expanded, setExpanded] = useState(isDetail);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const [imageLandscape, setImageLandscape] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const canMutate =
    Boolean(user) &&
    (String(user._id) === String(author._id) || user.role === "admin");
  const isAuthor = Boolean(user) && String(user._id) === String(author._id);

  const tokens = useMemo(() => tokenize(post?.content || ""), [post?.content]);

  const handleLikeClick = useCallback(async () => {
    if (likeBusy) return;
    if (!user) {
      navigate("/login");
      return;
    }

    const nextLiked = !liked;
    const delta = nextLiked ? 1 : -1;

    setLiked(nextLiked);
    setLikesCount((prev) => Math.max(0, prev + delta));
    setLikeBusy(true);

    if (nextLiked) {
      setPopping(true);
      window.clearTimeout(popTimerRef.current);
      popTimerRef.current = window.setTimeout(() => setPopping(false), 360);
    }

    try {
      const data = await postService.toggleLike(post._id);
      if (typeof data?.likesCount === "number") {
        setLikesCount(data.likesCount);
      }
      if (typeof data?.liked === "boolean") {
        setLiked(data.liked);
      }
      onLikeToggle?.({
        ...post,
        likesCount: data?.likesCount ?? likesCount + delta,
        liked: data?.liked ?? nextLiked,
      });
    } catch {
      setLiked(!nextLiked);
      setLikesCount((prev) => Math.max(0, prev - delta));
      notify.error("Couldn't update like.");
    } finally {
      setLikeBusy(false);
    }
  }, [likeBusy, liked, likesCount, navigate, onLikeToggle, post, user]);

  const handleCopyLink = useCallback(async () => {
    const url = `${window.location.origin}/posts/${post._id}`;
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ url, title: "Pulse post" });
        return;
      }
      await navigator.clipboard.writeText(url);
      notify.success("Link copied.");
    } catch {
      notify.error("Couldn't copy link.");
    }
  }, [post._id]);

  const handleDeleteConfirm = useCallback(async () => {
    try {
      await postService.deletePost(post._id);
      setConfirmOpen(false);
      setRemoving(true);
      window.setTimeout(() => onDelete?.(post._id), 200);
      notify.success("Post deleted.");
    } catch {
      notify.error("Couldn't delete post.");
      setConfirmOpen(false);
    }
  }, [onDelete, post._id]);

  const menuItems = useMemo(() => {
    const items = [
      { key: "copy", label: "Copy link", icon: Link2, onClick: handleCopyLink },
    ];
    if (canMutate) {
      items.push({ divider: true });
      items.push({
        key: "delete",
        label: isAuthor ? "Delete post" : "Delete post (admin)",
        icon: Trash2,
        danger: true,
        onClick: () => setConfirmOpen(true),
      });
    }
    return items;
  }, [canMutate, handleCopyLink, isAuthor]);

  const handleImageLoad = (event) => {
    const img = event.currentTarget;
    if (
      img.naturalWidth > 0 &&
      img.naturalWidth / img.naturalHeight >= HORIZONTAL_RATIO_THRESHOLD
    ) {
      setImageLandscape(true);
    }
    setImageLoaded(true);
  };

  if (!post) return null;

  const fullImage = post.image?.url
    ? cldUrl(post.image.url, { w: isDetail ? 1080 : 800, q: "auto", f: "auto" })
    : "";
  const placeholderImage = post.image?.url
    ? cldUrl(post.image.url, { w: 60, q: "auto:low", f: "auto" })
    : "";

  const altText = post.content
    ? truncate(post.content, 80)
    : `Post by @${username}`;

  const createdIso = toIso(post.createdAt);
  const createdRelative = formatRelative(post.createdAt);
  const createdAbsolute = formatAbsolute(post.createdAt);

  const showImage = !isCompact && Boolean(post.image?.url);
  const clampBody = !isDetail && !expanded;

  const likeLabel = liked ? "Unlike" : "Like";
  const commentLabel = "Comment";
  const shareLabel = "Share";

  return (
    <>
      <article
        aria-busy={likeBusy || removing || undefined}
        className={cn(
          "group rounded-xl border border-zinc-200 bg-white transition-[border,box-shadow] duration-fast dark:border-zinc-800 dark:bg-zinc-900",
          "hover:border-zinc-300 hover:shadow-xs dark:hover:border-zinc-700",
          isCompact ? "p-3" : "p-4",
          removing && "motion-safe:animate-shrink-out",
          className
        )}
      >
        <header className="flex items-start gap-3">
          <Link
            to={profileHref}
            className="shrink-0 rounded-full"
            aria-label={`@${username} profile`}
          >
            <Avatar
              src={author.avatar?.url}
              name={author.name}
              username={author.username}
              size={isCompact ? "sm" : "md"}
            />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-1.5 text-sm">
              <Link
                to={profileHref}
                className="min-w-0 truncate font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
              >
                {author.name || `@${username}`}
              </Link>
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
            {author.name && (
              <Link
                to={profileHref}
                className="block truncate text-xs text-zinc-500 hover:underline dark:text-zinc-400"
              >
                @{username}
              </Link>
            )}
          </div>

          {menuItems.length > 0 && (
            <Dropdown
              trigger={
                <IconButton
                  icon={MoreHorizontal}
                  aria-label="Post menu"
                  variant="ghost"
                  size="sm"
                />
              }
              items={menuItems}
              align="end"
              width="w-52"
            />
          )}
        </header>

        {tokens.length > 0 && (
          <div
            className={cn(
              "mt-2 text-base leading-relaxed whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-100",
              clampBody && "line-clamp-6"
            )}
          >
            {renderTokens(tokens)}
          </div>
        )}

        {clampBody && (post.content?.length ?? 0) > 280 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Show more
          </button>
        )}

        {showImage && (
          <div className="mt-3">
            {imageBroken ? (
              <div
                className={cn(
                  "flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500",
                  imageLandscape ? "aspect-video" : "aspect-[4/5]"
                )}
                role="img"
                aria-label="Image failed to load"
              >
                <ImageOff className="size-8" aria-hidden="true" />
              </div>
            ) : (
              <Link
                to={postHref}
                className={cn(
                  "relative block overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800",
                  imageLandscape ? "aspect-video" : "aspect-[4/5]"
                )}
              >
                {placeholderImage && (
                  <img
                    src={placeholderImage}
                    alt=""
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 size-full scale-110 object-cover blur-xl transition-opacity duration-base",
                      imageLoaded ? "opacity-0" : "opacity-100"
                    )}
                  />
                )}
                <img
                  src={fullImage}
                  alt={altText}
                  loading={priority ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={priority ? "high" : "auto"}
                  referrerPolicy="no-referrer"
                  onLoad={handleImageLoad}
                  onError={() => setImageBroken(true)}
                  className={cn(
                    "relative size-full cursor-zoom-in object-cover transition-opacity duration-base",
                    imageLoaded ? "opacity-100" : "opacity-0"
                  )}
                />
              </Link>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
          <Tooltip content={likeLabel}>
            <button
              type="button"
              onClick={handleLikeClick}
              aria-pressed={liked}
              aria-label={likeLabel}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors duration-fast",
                "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400",
                liked && "text-rose-600 dark:text-rose-400"
              )}
            >
              <Heart
                className={cn(
                  "size-5 transition-transform",
                  liked && "fill-current",
                  popping && "motion-safe:animate-like-pop"
                )}
                aria-hidden="true"
              />
              <span className="tnum">
                {isDetail
                  ? pluralize(likesCount, "like")
                  : compactCount(likesCount)}
              </span>
            </button>
          </Tooltip>

          <Tooltip content={commentLabel}>
            <Link
              to={postHref}
              aria-label={commentLabel}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors duration-fast hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              <span className="tnum">
                {isDetail
                  ? pluralize(post.commentsCount ?? 0, "comment")
                  : compactCount(post.commentsCount ?? 0)}
              </span>
            </Link>
          </Tooltip>

          <Tooltip content={shareLabel}>
            <button
              type="button"
              onClick={handleCopyLink}
              aria-label={shareLabel}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors duration-fast hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Share2 className="size-5" aria-hidden="true" />
              {isDetail && <span>Share</span>}
            </button>
          </Tooltip>
        </div>
      </article>

      <ConfirmModal
        open={confirmOpen}
        title="Delete post"
        description="You're about to delete this post. This action can't be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        busyLabel="Deleting…"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

export default memo(PostCard);
