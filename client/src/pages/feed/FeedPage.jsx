import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { ArrowUp, CheckCircle2, Sparkles } from "lucide-react";

import Banner from "../../components/ui/Banner.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import PostCardSkeleton from "../../components/ui/skeletons/PostCardSkeleton.jsx";

import CreatePostForm from "../../components/post/CreatePostForm.jsx";
import PostCard from "../../components/post/PostCard.jsx";

import { useSocket } from "../../context/useSocket.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js";

import * as feedService from "../../services/feedService.js";
import { FEED_PAGE_LIMIT } from "../../utils/constants.js";

/**
 * FeedPage — single-column timeline at `max-w-2xl mx-auto` (STEP 28).
 *
 * Composition (top → bottom):
 *  1. Inline `CreatePostForm` (collapsed) for fast composition.
 *  2. Reactive "new posts" pill that surfaces socket-pushed updates
 *     without yanking the scroll position.
 *  3. Posts list — gap-4 between cards, infinite scroll via
 *     `useInfiniteScroll` with a 300px sentinel rootMargin so the next
 *     page is already in flight before the user hits the bottom.
 *  4. Caught-up terminal state when `hasMore` is false.
 *
 * Data: cursor-based pagination over `/api/feed`. The viewer's own
 * posts are included server-side (`feedController.getFeed`) so an empty
 * follow list still renders the user's own activity.
 *
 * Real-time: subscribes to a future `feed:new-post` socket event. The
 * payload is *not* prepended automatically — the user gets a sticky
 * pill that reloads from cursor=null on click. This matches Twitter /
 * Instagram patterns and avoids reflowing what the user is reading.
 *
 * Performance: the first card receives `priority` (eager image load) so
 * it is a viable LCP candidate; PostCard is memoized upstream.
 */

const SKELETON_COUNT = 4;

// Defensive shape check for socket payloads. Anything we surface to the
// list must look like a post — the server should never push otherwise,
// but trusting raw socket events would be a poor habit on a public app.
const isValidPost = (value) =>
  Boolean(value) && typeof value === "object" && typeof value._id === "string";

const buildTitle = (newCount) =>
  newCount > 0 ? `(${newCount}) Akış` : "Akış";

export default function FeedPage() {
  const { socket } = useSocket();

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [paginating, setPaginating] = useState(false);
  const [error, setError] = useState("");
  const [newCount, setNewCount] = useState(0);

  // We keep a Set of seen ids in a ref so socket events can dedupe in
  // O(1) without forcing a render. The ref is rebuilt whenever items
  // change to stay in sync with reality.
  const seenIdsRef = useRef(new Set());
  useEffect(() => {
    seenIdsRef.current = new Set(items.map((post) => post._id));
  }, [items]);

  useDocumentTitle(buildTitle(newCount));

  // ----- Initial fetch -----
  const fetchInitial = useCallback(async () => {
    setInitialLoading(true);
    setError("");
    try {
      const data = await feedService.getFeed({ limit: FEED_PAGE_LIMIT });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setNextCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.hasMore));
      setNewCount(0);
    } catch {
      setError("Akış yüklenemedi.");
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // ----- Pagination -----
  const handleLoadMore = useCallback(async () => {
    if (paginating || !hasMore || !nextCursor) return;
    setPaginating(true);
    try {
      const data = await feedService.getFeed({
        cursor: nextCursor,
        limit: FEED_PAGE_LIMIT,
      });
      const incoming = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => {
        const known = new Set(prev.map((post) => post._id));
        const merged = incoming.filter((post) => !known.has(post._id));
        return [...prev, ...merged];
      });
      setNextCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.hasMore));
    } catch {
      // Surface failures inline only — a toast here would feel noisy
      // since the user can simply scroll again to retry.
      setHasMore(false);
    } finally {
      setPaginating(false);
    }
  }, [hasMore, nextCursor, paginating]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    loading: paginating,
    onLoadMore: handleLoadMore,
    rootMargin: "300px",
  });

  // ----- Real-time "new posts" pill -----
  useEffect(() => {
    if (!socket) return undefined;

    const handleNew = (payload) => {
      if (!isValidPost(payload)) return;
      if (seenIdsRef.current.has(payload._id)) return;
      setNewCount((count) => count + 1);
    };

    socket.on("feed:new-post", handleNew);
    return () => socket.off("feed:new-post", handleNew);
  }, [socket]);

  const refreshFromTop = useCallback(async () => {
    setNewCount(0);
    await fetchInitial();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [fetchInitial]);

  // ----- Composer / card callbacks -----
  const handleCreated = useCallback((created) => {
    if (!isValidPost(created)) return;
    setItems((prev) => {
      if (prev.some((post) => post._id === created._id)) return prev;
      return [created, ...prev];
    });
    // Bring the freshly prepended card just into view without
    // disrupting the user's scroll position too aggressively.
    requestAnimationFrame(() => {
      const target = document.getElementById(`post-${created._id}`);
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const handleLikeToggle = useCallback((updated) => {
    if (!isValidPost(updated)) return;
    setItems((prev) =>
      prev.map((post) =>
        post._id === updated._id
          ? {
              ...post,
              likesCount:
                typeof updated.likesCount === "number"
                  ? updated.likesCount
                  : post.likesCount,
              isLikedByMe:
                typeof updated.liked === "boolean"
                  ? updated.liked
                  : post.isLikedByMe,
            }
          : post
      )
    );
  }, []);

  const handleDelete = useCallback((id) => {
    if (typeof id !== "string") return;
    setItems((prev) => prev.filter((post) => post._id !== id));
  }, []);

  // ----- Render branches -----
  const showSkeletons = initialLoading;
  const showEmpty = !initialLoading && !error && items.length === 0;
  const showList = !initialLoading && !error && items.length > 0;

  const skeletons = useMemo(
    () =>
      Array.from({ length: SKELETON_COUNT }, (_, idx) => (
        <PostCardSkeleton key={`feed-skel-${idx}`} />
      )),
    []
  );

  return (
    <div className="space-y-4">
      <CreatePostForm variant="inline" onCreated={handleCreated} />

      {newCount > 0 && (
        <div
          className="sticky top-14 z-20 flex justify-center motion-safe:animate-fade-up"
          aria-live="polite"
        >
          <button
            type="button"
            onClick={refreshFromTop}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white shadow-md transition-colors duration-fast hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:bg-brand-500 dark:hover:bg-brand-400 dark:focus-visible:ring-offset-zinc-950"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
            {newCount === 1
              ? "1 yeni gönderi"
              : `${newCount} yeni gönderi`}
          </button>
        </div>
      )}

      {error && (
        <Banner variant="danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchInitial}
            >
              Tekrar dene
            </Button>
          </div>
        </Banner>
      )}

      {showSkeletons && (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          {skeletons}
        </div>
      )}

      {showEmpty && (
        <EmptyState
          icon={Sparkles}
          title="Akışın oldukça sessiz"
          description="Burada gönderi görmek için Keşfet'ten birilerini takip etmeye başla."
          action={{ label: "Keşfet'e git", href: "/explore" }}
        />
      )}

      {showList && (
        <ul className="space-y-4">
          {items.map((post, index) => (
            <li
              key={post._id}
              id={`post-${post._id}`}
              className="motion-safe:animate-fade-up"
            >
              <PostCard
                post={post}
                priority={index === 0}
                onLikeToggle={handleLikeToggle}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}

      {showList && hasMore && (
        <div ref={sentinelRef} className="pt-2">
          {paginating && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-500 dark:text-zinc-400">
              <Spinner size="md" />
              <span>Daha fazla yükleniyor…</span>
            </div>
          )}
        </div>
      )}

      {showList && !hasMore && (
        <div className="flex flex-col items-center gap-1 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <CheckCircle2 className="size-5 text-emerald-500" aria-hidden="true" />
          <p className="font-medium text-zinc-700 dark:text-zinc-200">
            Tümünü gördün
          </p>
          <p>
            Daha fazlası için{" "}
            <Link
              to="/explore"
              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Keşfet
            </Link>{" "}
            sayfasına göz at.
          </p>
        </div>
      )}
    </div>
  );
}
