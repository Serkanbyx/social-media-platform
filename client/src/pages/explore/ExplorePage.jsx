import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Flame, Search, SearchX, Users, X } from "lucide-react";

import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import IconButton from "../../components/ui/IconButton.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import PostCardSkeleton from "../../components/ui/skeletons/PostCardSkeleton.jsx";
import UserCardSkeleton from "../../components/ui/skeletons/UserCardSkeleton.jsx";

import PostCard from "../../components/post/PostCard.jsx";
import UserCard from "../../components/user/UserCard.jsx";

import { useAuth } from "../../context/AuthContext.jsx";
import useDebounce from "../../hooks/useDebounce.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js";

import * as postService from "../../services/postService.js";
import * as userService from "../../services/userService.js";
import { EXPLORE_PAGE_LIMIT } from "../../utils/constants.js";

/**
 * ExplorePage — public discovery surface (STEP 29).
 *
 * Two zones, swapped by whether the search query is empty:
 *  - q.length === 0  → Trending grid (responsive 1 / 2 / 3 columns)
 *  - q.length  >  0  → People (top 5, expandable) + Posts results list
 *
 * Data flow:
 *  - The search box is debounced (400 ms) so each keystroke does not fire
 *    a request, and the actual `q` is mirrored to the URL via
 *    `useSearchParams` so deep links survive navigation/back/forward.
 *  - A single `fetchPosts` effect resets pagination whenever the
 *    debounced query changes; it always passes `q` (server treats an
 *    empty value as the trending feed).
 *  - People are queried in parallel only when there is a query — there
 *    is no notion of "trending people".
 *
 * Public access:
 *  - The whole page works without login. Guests who try to follow are
 *    intercepted by `FollowButton`'s `onRequireAuth` callback, which
 *    surfaces a centered "Sign in to interact" modal here. Like /
 *    comment redirects fall through to `PostCard`'s built-in /login
 *    redirect, since those buttons are not aware of this page.
 *
 * Accessibility:
 *  - The search input owns `role="search"` via its labelled wrapper.
 *  - Section titles use semantic h2/h3 so screen readers can navigate
 *    between People and Posts/Trending.
 *  - ESC clears the input and restores trending view.
 */

const SEARCH_DEBOUNCE_MS = 400;
const MAX_QUERY_LENGTH = 80;
const PEOPLE_PREVIEW_COUNT = 5;
const GRID_SKELETON_COUNT = 8;
const LIST_SKELETON_COUNT = 4;
const TRENDING_BADGE_LIMIT = 10;

const sanitizeQuery = (value) => {
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_QUERY_LENGTH);
};

export default function ExplorePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = sanitizeQuery(searchParams.get("q") || "");

  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);

  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [paginating, setPaginating] = useState(false);
  const [postsError, setPostsError] = useState("");

  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleExpanded, setPeopleExpanded] = useState(false);

  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  // The committed (debounced) query is the source of truth for "is the
  // user actively searching?". Using `query` directly would flicker the
  // empty-state during typing, which feels janky.
  const activeQuery = debouncedQuery;
  const hasQuery = activeQuery.length > 0;

  // Track an in-flight pending state (typing → not yet fetching) so we
  // can surface a subtle spinner inside the input's right addon.
  const pendingDebounce = query.trim() !== debouncedQuery;

  useDocumentTitle(hasQuery ? `Ara: "${activeQuery}"` : "Keşfet");

  // ----- URL sync (debounced query <-> ?q=) -----
  // Bidirectional: typing updates the URL (debounced, replace history so
  // each keystroke isn't a back-button trap), and an external URL change
  // (e.g. a hashtag link in PostCard) updates the input.
  useEffect(() => {
    const current = sanitizeQuery(searchParams.get("q") || "");
    if (current === activeQuery) return;
    const next = new URLSearchParams(searchParams);
    if (activeQuery) {
      next.set("q", activeQuery);
    } else {
      next.delete("q");
    }
    setSearchParams(next, { replace: true });
  }, [activeQuery, searchParams, setSearchParams]);

  useEffect(() => {
    const fromUrl = sanitizeQuery(searchParams.get("q") || "");
    if (fromUrl !== query.trim() && fromUrl !== debouncedQuery) {
      setQuery(fromUrl);
    }
    // We intentionally only react to URL → state when the URL changes,
    // not on every keystroke (which would cause an infinite ping-pong
    // with the effect above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Reset the "view all" toggle whenever the query changes — otherwise
  // expanding for one term silently carries over into the next.
  useEffect(() => {
    setPeopleExpanded(false);
  }, [activeQuery]);

  // ----- Posts fetch (trending OR search) -----
  // We use a request-id guard to drop stale responses: if the user types
  // fast, an older fetch may resolve after a newer one, which would
  // otherwise overwrite fresh results with stale ones.
  const requestIdRef = useRef(0);

  const fetchPosts = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setInitialLoading(true);
    setPostsError("");

    try {
      const data = await postService.explorePosts({
        limit: EXPLORE_PAGE_LIMIT,
        q: activeQuery || undefined,
      });
      if (requestIdRef.current !== requestId) return;
      setPosts(Array.isArray(data?.items) ? data.items : []);
      setNextCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.hasMore));
    } catch {
      if (requestIdRef.current !== requestId) return;
      setPostsError("Gönderiler yüklenemedi.");
      setPosts([]);
      setHasMore(false);
    } finally {
      if (requestIdRef.current === requestId) {
        setInitialLoading(false);
      }
    }
  }, [activeQuery]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ----- Pagination -----
  const handleLoadMore = useCallback(async () => {
    if (paginating || !hasMore || !nextCursor) return;
    setPaginating(true);
    try {
      const data = await postService.explorePosts({
        cursor: nextCursor,
        limit: EXPLORE_PAGE_LIMIT,
        q: activeQuery || undefined,
      });
      const incoming = Array.isArray(data?.items) ? data.items : [];
      setPosts((prev) => {
        const known = new Set(prev.map((post) => post._id));
        const merged = incoming.filter((post) => !known.has(post._id));
        return [...prev, ...merged];
      });
      setNextCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.hasMore));
    } catch {
      // Inline failure: don't toast (the user is just scrolling) — flip
      // hasMore off so the sentinel stops thrashing the network.
      setHasMore(false);
    } finally {
      setPaginating(false);
    }
  }, [activeQuery, hasMore, nextCursor, paginating]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    loading: paginating,
    onLoadMore: handleLoadMore,
    rootMargin: "400px",
  });

  // ----- People fetch (only when there's a query) -----
  useEffect(() => {
    if (!hasQuery) {
      setPeople([]);
      setPeopleLoading(false);
      return undefined;
    }

    let cancelled = false;
    setPeopleLoading(true);

    userService
      .searchUsers(activeQuery)
      .then((data) => {
        if (cancelled) return;
        setPeople(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        // People panel is a "nice to have" alongside the post results;
        // failing silently keeps the page useful instead of red.
        if (!cancelled) setPeople([]);
      })
      .finally(() => {
        if (!cancelled) setPeopleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeQuery, hasQuery]);

  // ----- Card-level callbacks -----
  const handleLikeToggle = useCallback((updated) => {
    if (!updated || typeof updated._id !== "string") return;
    setPosts((prev) =>
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
    setPosts((prev) => prev.filter((post) => post._id !== id));
  }, []);

  const handleRequireAuth = useCallback(() => {
    setAuthPromptOpen(true);
  }, []);

  // ----- Search input handlers -----
  const handleQueryChange = (event) => {
    setQuery(sanitizeQuery(event.target.value));
  };

  const handleClearQuery = useCallback(() => {
    setQuery("");
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && query.length > 0) {
      event.preventDefault();
      handleClearQuery();
    }
  };

  // ----- Derived render state -----
  const visiblePeople = useMemo(
    () =>
      peopleExpanded ? people : people.slice(0, PEOPLE_PREVIEW_COUNT),
    [people, peopleExpanded]
  );

  const peopleHasMore = people.length > PEOPLE_PREVIEW_COUNT;

  const showPostsSkeleton = initialLoading;
  const showPostsEmpty = !initialLoading && !postsError && posts.length === 0;
  const showPostsList = !initialLoading && !postsError && posts.length > 0;

  const skeletonGrid = useMemo(
    () =>
      Array.from({ length: GRID_SKELETON_COUNT }, (_, idx) => (
        <PostCardSkeleton key={`explore-grid-skel-${idx}`} />
      )),
    []
  );
  const skeletonList = useMemo(
    () =>
      Array.from({ length: LIST_SKELETON_COUNT }, (_, idx) => (
        <PostCardSkeleton key={`explore-list-skel-${idx}`} />
      )),
    []
  );
  const skeletonPeople = useMemo(
    () =>
      Array.from({ length: 3 }, (_, idx) => (
        <UserCardSkeleton key={`explore-people-skel-${idx}`} />
      )),
    []
  );

  return (
    <div className="space-y-6">
      {/* ----- Search input (sticky on mobile) ----- */}
      <div
        role="search"
        className="sticky top-14 z-10 -mx-4 bg-white/85 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none dark:bg-zinc-950/85 sm:dark:bg-transparent"
      >
        <Input
          type="search"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Gönderi veya kişi ara"
          aria-label="Gönderi veya kişi ara"
          autoComplete="off"
          spellCheck={false}
          leftAddon={<Search className="size-5" aria-hidden="true" />}
          rightAddon={
            pendingDebounce ? (
              <Spinner size="sm" />
            ) : query.length > 0 ? (
              <IconButton
                icon={X}
                size="sm"
                variant="ghost"
                aria-label="Aramayı temizle"
                onClick={handleClearQuery}
              />
            ) : null
          }
        />
      </div>

      {/* ----- People section (only while searching) ----- */}
      {hasQuery && (
        <section
          aria-labelledby="explore-people-title"
          className="space-y-3 motion-safe:animate-fade-up"
        >
          <header className="flex items-center justify-between gap-3">
            <h2
              id="explore-people-title"
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
            >
              <Users
                className="size-4 text-zinc-400 dark:text-zinc-500"
                aria-hidden="true"
              />
              Kişiler
            </h2>
            {peopleHasMore && (
              <button
                type="button"
                onClick={() => setPeopleExpanded((value) => !value)}
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {peopleExpanded ? "Daha az göster" : "Tümünü gör"}
              </button>
            )}
          </header>

          {peopleLoading ? (
            <ul className="space-y-2" aria-busy="true" aria-live="polite">
              {skeletonPeople}
            </ul>
          ) : people.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Bu aramayla eşleşen kişi yok.
            </p>
          ) : (
            <ul className="space-y-2">
              {visiblePeople.map((person) => (
                <UserCard
                  key={person._id}
                  user={person}
                  onRequireAuth={handleRequireAuth}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ----- Posts header (Trending or Search results) ----- */}
      <section
        aria-labelledby="explore-posts-title"
        className="space-y-4"
      >
        <header className="space-y-1">
          {hasQuery ? (
            <>
              <h2
                id="explore-posts-title"
                className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
              >
                Gönderiler
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                <span className="text-zinc-700 dark:text-zinc-200">
                  &quot;{activeQuery}&quot;
                </span>{" "}
                için sonuçlar
              </p>
            </>
          ) : (
            <>
              <h2
                id="explore-posts-title"
                className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50"
              >
                <Flame
                  className="size-5 text-amber-500"
                  aria-hidden="true"
                />
                Trend gönderiler
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Son 7 günün öne çıkan paylaşımları
              </p>
            </>
          )}
        </header>

        {postsError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <span>{postsError}</span>
            <Button variant="secondary" size="sm" onClick={fetchPosts}>
              Tekrar dene
            </Button>
          </div>
        )}

        {/* Skeletons match the active layout (grid for trending, list for search) */}
        {showPostsSkeleton && (
          <div
            aria-busy="true"
            aria-live="polite"
            className={
              hasQuery
                ? "space-y-4"
                : "grid grid-cols-1 gap-4 sm:grid-cols-2"
            }
          >
            {hasQuery ? skeletonList : skeletonGrid}
          </div>
        )}

        {showPostsEmpty &&
          (hasQuery ? (
            <EmptyState
              icon={SearchX}
              title="Sonuç bulunamadı"
              description="Farklı bir kelimeyle aramayı dene."
            />
          ) : (
            <EmptyState
              icon={Flame}
              title="Henüz trend bir şey yok"
              description="İlk paylaşımı yaparak burayı sen başlatabilirsin."
              action={
                user
                  ? { label: "Gönderi oluştur", href: "/posts/new" }
                  : { label: "Giriş yap", href: "/login" }
              }
            />
          ))}

        {showPostsList &&
          (hasQuery ? (
            <ul className="space-y-4 motion-safe:animate-fade-up">
              {posts.map((post) => (
                <li key={post._id}>
                  <PostCard
                    post={post}
                    onLikeToggle={handleLikeToggle}
                    onDelete={handleDelete}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-1 gap-4 motion-safe:animate-fade-up sm:grid-cols-2">
              {posts.map((post, index) => (
                <li
                  key={post._id}
                  className="relative transition-all duration-base hover:-translate-y-0.5 hover:shadow-md motion-safe:animate-fade-up"
                >
                  {index < TRENDING_BADGE_LIMIT && (
                    <Badge
                      variant="brand"
                      size="sm"
                      className="absolute left-3 top-3 z-10 shadow-sm"
                    >
                      <Flame
                        className="mr-1 size-3"
                        aria-hidden="true"
                      />
                      Trend
                    </Badge>
                  )}
                  <PostCard
                    post={post}
                    onLikeToggle={handleLikeToggle}
                    onDelete={handleDelete}
                  />
                </li>
              ))}
            </ul>
          ))}

        {showPostsList && hasMore && (
          <div ref={sentinelRef} className="pt-2">
            {paginating && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                <Spinner size="md" />
                <span>Daha fazla yükleniyor…</span>
              </div>
            )}
          </div>
        )}

        {showPostsList && !hasMore && (
          <p className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Tümünü gördün
          </p>
        )}
      </section>

      {/* ----- Sign-in prompt (centered modal) ----- */}
      <Modal
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        title="Etkileşim için giriş yap"
        description="Pulse'ta beğenmek, takip etmek ve yorum yazmak için bir hesaba ihtiyacın var."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAuthPromptOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAuthPromptOpen(false);
                navigate("/register");
              }}
            >
              Kayıt ol
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setAuthPromptOpen(false);
                navigate("/login");
              }}
            >
              Giriş yap
            </Button>
          </>
        }
      >
        <p>
          Hesabınla anında geri döneceksin — sayfa konumun korunur.
        </p>
      </Modal>
    </div>
  );
}
