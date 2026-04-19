import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUp, FileQuestion } from "lucide-react";

import Avatar from "../../components/ui/Avatar.jsx";
import Banner from "../../components/ui/Banner.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import CharacterCounter from "../../components/ui/CharacterCounter.jsx";
import Divider from "../../components/ui/Divider.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import IconButton from "../../components/ui/IconButton.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import Tooltip from "../../components/ui/Tooltip.jsx";
import {
  CommentItemSkeleton,
  PostCardSkeleton,
} from "../../components/ui/skeletons/index.js";

import CommentItem from "../../components/post/CommentItem.jsx";
import PostCard from "../../components/post/PostCard.jsx";

import { useAuth } from "../../context/useAuth.js";
import { useSocket } from "../../context/useSocket.js";

import useAutoResizeTextarea from "../../hooks/useAutoResizeTextarea.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js";

import * as commentService from "../../services/commentService.js";
import * as postService from "../../services/postService.js";

import {
  COMMENTS_PAGE_LIMIT,
  MAX_COMMENT,
} from "../../utils/constants.js";
import compactCount from "../../utils/formatCount.js";
import { formatAbsolute, toIso } from "../../utils/formatDate.js";
import { notify } from "../../utils/notify.js";

/**
 * PostDetailPage — focused conversation view for a single post (STEP 30).
 *
 * Outer wrapper is intentionally trivial: it reads the route param and
 * renders an inner view *keyed by id*. Remounting on id change gives us
 * fresh state for free — no manual reset block, no risk of leaking the
 * previous post's data into a new id during the load gap.
 *
 * Layout (top → bottom): back button · post (`variant="detail"`) ·
 * counts strip · divider · comment composer · comments list. The whole
 * column is constrained to `max-w-2xl` so long-form text and full-width
 * images stay comfortably readable on desktop.
 *
 * Comment composer:
 *  - Hidden entirely for unauthenticated viewers — we render a sign-in
 *    Card instead. A disabled "active" form would let some browsers
 *    submit it via Enter and would just be a teaser UX dark pattern.
 *  - Optimistic add: on success the new comment is prepended, the local
 *    `commentsCount` is bumped, the textarea clears and refocuses so
 *    the user can keep replying without grabbing their cursor again.
 *  - `Cmd/Ctrl + Enter` submits.
 *
 * Real-time polish:
 *  - Listens for an optional `comment:new:<postId>` socket event. When
 *    the server starts emitting it (today the listener is a no-op), a
 *    "↑ N new comment(s)" pill surfaces above the list and refetches
 *    the first page on click — same pattern the feed uses for new
 *    posts so users never get their scroll position yanked.
 *
 * Security: the composer is gated by `user`, comment delete is gated by
 * `canDeleteComment` inside `CommentItem`, and post delete is gated
 * inside `PostCard`. Every gate is mirrored on the server.
 */
export default function PostDetailPage() {
  const { id } = useParams();
  if (!id) return null;
  return <PostDetailView key={id} postId={id} />;
}

function PostDetailView({ postId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [post, setPost] = useState(null);
  const [postLoading, setPostLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [paginating, setPaginating] = useState(false);

  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [composerError, setComposerError] = useState("");

  const [newCount, setNewCount] = useState(0);

  const textareaRef = useRef(null);
  const formId = useId();
  const errorId = `${formId}-error`;

  useAutoResizeTextarea(textareaRef, draft, { maxHeight: 240 });

  const docTitle = useMemo(() => {
    if (notFound) return "Post not found";
    if (!post) return "Post";
    const author =
      post.author?.name ||
      (post.author?.username ? `@${post.author.username}` : "Pulse");
    return `Post by ${author}`;
  }, [notFound, post]);

  useDocumentTitle(docTitle);

  const fetchComments = useCallback(
    async (cursor) => {
      const data = await commentService.getCommentsByPost(
        postId,
        cursor,
        COMMENTS_PAGE_LIMIT
      );
      return {
        items: Array.isArray(data?.items) ? data.items : [],
        nextCursor: data?.nextCursor || null,
        hasMore: Boolean(data?.hasMore),
      };
    },
    [postId]
  );

  // Initial fetch — post + first page of comments in parallel.
  // No synchronous reset block needed: the parent keys this view by id
  // so a route change unmounts and remounts the whole subtree.
  useEffect(() => {
    let cancelled = false;

    const loadPost = async () => {
      try {
        const data = await postService.getPostById(postId);
        if (cancelled) return;
        setPost(data?.post || null);
        setNotFound(!data?.post);
      } catch (error) {
        if (cancelled) return;
        if (error?.response?.status === 404) {
          setNotFound(true);
        } else {
          notify.error("Couldn't load post.");
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setPostLoading(false);
      }
    };

    const loadComments = async () => {
      try {
        const page = await fetchComments(undefined);
        if (cancelled) return;
        setComments(page.items);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setCommentsError("");
      } catch (error) {
        if (cancelled) return;
        // 404 here means the post itself is gone — we let the post
        // loader own the empty state, so silence the comments banner.
        if (error?.response?.status === 404) {
          setComments([]);
          setHasMore(false);
        } else {
          setCommentsError("Couldn't load comments.");
        }
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    };

    loadPost();
    loadComments();

    return () => {
      cancelled = true;
    };
  }, [postId, fetchComments]);

  // ----- Pagination -----
  const handleLoadMore = useCallback(async () => {
    if (paginating || !hasMore || !nextCursor) return;
    setPaginating(true);
    try {
      const page = await fetchComments(nextCursor);
      setComments((prev) => {
        const seen = new Set(prev.map((entry) => entry._id));
        const merged = page.items.filter((entry) => !seen.has(entry._id));
        return [...prev, ...merged];
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Surfacing inline via `commentsError` would feel noisy mid-scroll;
      // we just stop pagination so the user can scroll again to retry.
      setHasMore(false);
    } finally {
      setPaginating(false);
    }
  }, [fetchComments, hasMore, nextCursor, paginating]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    loading: paginating || commentsLoading,
    onLoadMore: handleLoadMore,
    rootMargin: "240px",
  });

  // ----- Real-time pill (forward-compatible no-op until server emits) -----
  useEffect(() => {
    if (!socket) return undefined;
    const handleNew = (payload) => {
      if (!payload || typeof payload !== "object") return;
      // Self-authored comments are added optimistically by the composer
      // already, so don't double-count them via the pill.
      if (
        user &&
        payload.author &&
        String(payload.author._id || payload.author) === String(user._id)
      ) {
        return;
      }
      setNewCount((count) => count + 1);
    };
    socket.on(`comment:new:${postId}`, handleNew);
    return () => socket.off(`comment:new:${postId}`, handleNew);
  }, [socket, postId, user]);

  const refreshFromTop = useCallback(async () => {
    setNewCount(0);
    setCommentsLoading(true);
    try {
      const page = await fetchComments(undefined);
      setComments(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setCommentsError("");
    } catch {
      setCommentsError("Couldn't refresh comments.");
    } finally {
      setCommentsLoading(false);
    }
  }, [fetchComments]);

  // ----- Composer -----
  const trimmed = draft.trim();
  const overLimit = trimmed.length > MAX_COMMENT;
  const charPercent = MAX_COMMENT > 0 ? trimmed.length / MAX_COMMENT : 0;
  const announceCounter = charPercent >= 0.8;
  const canSubmitComment =
    Boolean(user) && !submitting && !overLimit && trimmed.length > 0;

  const handleCommentSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();
      if (!canSubmitComment) return;

      setSubmitting(true);
      setComposerError("");
      try {
        const data = await commentService.createComment(postId, trimmed);
        const created = data?.comment;
        if (created?._id) {
          setComments((prev) => [created, ...prev]);
          setPost((prev) =>
            prev
              ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 }
              : prev
          );
        }
        setDraft("");
        // Return focus to the textarea so the user can keep replying
        // without grabbing their cursor again.
        requestAnimationFrame(() => textareaRef.current?.focus());
        notify.success("Comment added.");
      } catch (error) {
        const errors = error?.response?.data?.errors;
        if (Array.isArray(errors) && errors.length > 0) {
          setComposerError(
            errors
              .map((entry) => entry?.msg)
              .filter(Boolean)
              .join(" ")
          );
        } else {
          setComposerError(
            error?.response?.data?.message || "Couldn't add comment."
          );
        }
        notify.error("Couldn't add comment.");
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmitComment, postId, trimmed]
  );

  const onComposerKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleCommentSubmit();
    }
  };

  // ----- Card callbacks -----
  const handleLikeToggle = useCallback((updated) => {
    if (!updated || typeof updated !== "object") return;
    setPost((prev) =>
      prev && prev._id === updated._id
        ? {
            ...prev,
            likesCount:
              typeof updated.likesCount === "number"
                ? updated.likesCount
                : prev.likesCount,
            isLikedByMe:
              typeof updated.liked === "boolean"
                ? updated.liked
                : prev.isLikedByMe,
          }
        : prev
    );
  }, []);

  const handlePostDelete = useCallback(() => {
    notify.success("Post deleted.");
    navigate("/");
  }, [navigate]);

  const handleCommentDelete = useCallback((commentId) => {
    setComments((prev) => prev.filter((entry) => entry._id !== commentId));
    setPost((prev) =>
      prev
        ? {
            ...prev,
            commentsCount: Math.max(0, (prev.commentsCount || 0) - 1),
          }
        : prev
    );
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  // ----- Derived render branches -----
  const showInitialLoading = postLoading || (commentsLoading && !post);
  const showNotFound = !postLoading && (notFound || !post);

  const skeletons = useMemo(
    () =>
      Array.from({ length: 3 }, (_, idx) => (
        <CommentItemSkeleton key={`comment-skel-${idx}`} />
      )),
    []
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <IconButton
          icon={ArrowLeft}
          aria-label="Go back"
          variant="ghost"
          size="sm"
          onClick={handleBack}
        />
        <h1 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Post
        </h1>
      </div>

      {showInitialLoading && (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <PostCardSkeleton />
          <Divider />
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {skeletons}
          </ul>
        </div>
      )}

      {showNotFound && !showInitialLoading && (
        <EmptyState
          icon={FileQuestion}
          title="Post not found"
          description="It may have been deleted or never existed."
          action={{ label: "Back to feed", href: "/" }}
        />
      )}

      {!showInitialLoading && !showNotFound && post && (
        <>
          <PostCard
            post={post}
            variant="detail"
            priority
            onLikeToggle={handleLikeToggle}
            onDelete={handlePostDelete}
          />

          <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="tabular-nums font-medium text-zinc-700 dark:text-zinc-200">
              {compactCount(post.likesCount ?? 0)}
            </span>{" "}
            likes ·{" "}
            <span className="tabular-nums font-medium text-zinc-700 dark:text-zinc-200">
              {compactCount(post.commentsCount ?? 0)}
            </span>{" "}
            comments ·{" "}
            <time
              dateTime={toIso(post.createdAt)}
              className="text-zinc-500 dark:text-zinc-400"
            >
              {formatAbsolute(post.createdAt)}
            </time>
          </p>

          <Divider />

          {user ? (
            <form
              onSubmit={handleCommentSubmit}
              aria-busy={submitting || undefined}
              className="rounded-xl border border-zinc-200 bg-white p-3 transition-colors duration-fast dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  src={user.avatar?.url}
                  name={user.name}
                  username={user.username}
                  size="sm"
                />

                <div className="min-w-0 flex-1">
                  <label htmlFor={`${formId}-comment`} className="sr-only">
                    Comment content
                  </label>
                  <textarea
                    id={`${formId}-comment`}
                    ref={textareaRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onComposerKeyDown}
                    placeholder="Write a comment…"
                    rows={1}
                    maxLength={MAX_COMMENT}
                    disabled={submitting}
                    aria-invalid={overLimit || Boolean(composerError) || undefined}
                    aria-describedby={composerError ? errorId : undefined}
                    className="block max-h-60 min-h-9 w-full resize-none overflow-auto border-0 bg-transparent text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-500 focus:outline-none disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  />

                  {composerError && (
                    <p
                      id={errorId}
                      role="alert"
                      className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400"
                    >
                      {composerError}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-end gap-3">
                    <CharacterCounter
                      value={trimmed}
                      max={MAX_COMMENT}
                      live={announceCounter}
                    />
                    <Tooltip content="Send with Cmd/Ctrl + Enter">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        loading={submitting}
                        disabled={!canSubmitComment}
                      >
                        {submitting ? "Sending…" : "Comment"}
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <Card padding="md" className="text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-zinc-700 dark:text-zinc-200">
                  Sign in to join the conversation.
                </p>
                <Button as={Link} to="/login" variant="primary" size="sm">
                  Sign in
                </Button>
              </div>
            </Card>
          )}

          {newCount > 0 && (
            <div
              className="sticky top-14 z-20 flex justify-center motion-safe:animate-fade-up"
              aria-live="polite"
            >
              <button
                type="button"
                onClick={refreshFromTop}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1.5 text-xs font-medium text-white shadow-md transition-colors duration-fast hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:bg-brand-500 dark:hover:bg-brand-400 dark:focus-visible:ring-offset-zinc-950"
              >
                <ArrowUp className="size-3.5" aria-hidden="true" />
                {newCount === 1
                  ? "1 new comment"
                  : `${newCount} new comments`}
              </button>
            </div>
          )}

          {commentsError && (
            <Banner variant="danger">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{commentsError}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={refreshFromTop}
                >
                  Try again
                </Button>
              </div>
            </Banner>
          )}

          {commentsLoading && (
            <ul
              className="divide-y divide-zinc-100 dark:divide-zinc-800"
              aria-busy="true"
              aria-live="polite"
            >
              {skeletons}
            </ul>
          )}

          {!commentsLoading && comments.length === 0 && !commentsError && (
            <EmptyState
              title="Be the first to comment"
              description="There are no comments on this post yet."
              className="py-8"
            />
          )}

          {!commentsLoading && comments.length > 0 && (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {comments.map((comment) => (
                <CommentItem
                  key={comment._id}
                  comment={comment}
                  postAuthorId={post.author?._id}
                  onDelete={handleCommentDelete}
                  className="motion-safe:animate-fade-up"
                />
              ))}
            </ul>
          )}

          {!commentsLoading && comments.length > 0 && hasMore && (
            <div ref={sentinelRef} className="pt-2">
              {paginating && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                  <Spinner size="md" />
                  <span>Loading more comments…</span>
                </div>
              )}
            </div>
          )}

          {!commentsLoading &&
            comments.length > 0 &&
            !hasMore &&
            !commentsError && (
              <p className="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                You've seen all the comments.
              </p>
            )}
        </>
      )}
    </div>
  );
}
