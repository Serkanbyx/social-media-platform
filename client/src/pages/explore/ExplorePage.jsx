import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock, Flame, Search, SearchX, Users, X } from "lucide-react";

import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import IconButton from "../../components/ui/IconButton.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import Tabs from "../../components/ui/Tabs.jsx";
import PostCardSkeleton from "../../components/ui/skeletons/PostCardSkeleton.jsx";
import UserCardSkeleton from "../../components/ui/skeletons/UserCardSkeleton.jsx";

import PostCard from "../../components/post/PostCard.jsx";
import UserCard from "../../components/user/UserCard.jsx";

import { useAuth } from "../../context/useAuth.js";
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
const SUGGESTED_PEOPLE_LIMIT = 8;
const SUGGESTED_PEOPLE_SKELETON_COUNT = 4;

// Sort modes for the posts feed. `trending` ranks by engagement inside a
// 90-day window; `latest` is strict reverse-chronological across all
// posts so a brand-new share always lands at the top of the page.
const SORT_TRENDING = "trending";
const SORT_LATEST = "latest";
const VALID_SORTS = new Set([SORT_TRENDING, SORT_LATEST]);

const sanitizeSort = (value) =>
  VALID_SORTS.has(value) ? value : SORT_TRENDING;

const sanitizeQuery = (value) => {
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_QUERY_LENGTH);
};

export default function ExplorePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = sanitizeQuery(searchParams.get("q") || "");
  const urlSort = sanitizeSort(searchParams.get("sort") || "");

  const [query, setQuery] = useState(urlQuery);
  const debouncedQuery = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);

  // Sort tab state. Mirrored to ?sort= in the URL for shareable deep links
  // (the same pattern used by `q`). Search results ignore the sort because
  // server-side search already orders results by relevance / recency.
  const [sort, setSort] = useState(urlSort);
  const [prevUrlSort, setPrevUrlSort] = useState(urlSort);
  if (urlSort !== prevUrlSort) {
    setPrevUrlSort(urlSort);
    if (urlSort !== sort) setSort(urlSort);
  }

  // URL → state sync done during render (React's recommended pattern for
  // mirroring an external value). Only adopt the URL value when it differs
  // from both the live and debounced query — otherwise typing would race
  // with the URL-write effect below and ping-pong forever.
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    if (urlQuery !== query.trim() && urlQuery !== debouncedQuery) {
      setQuery(urlQuery);
    }
  }

  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [paginating, setPaginating] = useState(false);
  const [postsError, setPostsError] = useState("");

  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleExpanded, setPeopleExpanded] = useState(false);

  // Suggested people are fetched once per mount (and again whenever the
  // viewer signs in / out so the personalised exclusion list stays
  // accurate). They are only rendered when there's no active search.
  const [suggestedPeople, setSuggestedPeople] = useState([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [suggestedError, setSuggestedError] = useState("");

  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  // The committed (debounced) query is the source of truth for "is the
  // user actively searching?". Using `query` directly would flicker the
  // empty-state during typing, which feels janky.
  const activeQuery = debouncedQuery;
  const hasQuery = activeQuery.length > 0;

  // Track an in-flight pending state (typing → not yet fetching) so we
  // can surface a subtle spinner inside the input's right addon.
  const pendingDebounce = query.trim() !== debouncedQuery;

  useDocumentTitle(
    hasQuery
      ? `Search: "${activeQuery}"`
      : sort === SORT_LATEST
        ? "Explore · Latest"
        : "Explore · Trending"
  );

  const isLatest = !hasQuery && sort === SORT_LATEST;
  const isTrending = !hasQuery && sort === SORT_TRENDING;

  const sortTabs = useMemo(
    () => [
      { id: SORT_TRENDING, label: "Trending", icon: Flame },
      { id: SORT_LATEST, label: "Latest", icon: Clock },
    ],
    []
  );

  const handleSortChange = useCallback((nextSort) => {
    setSort((prev) =>
      prev === sanitizeSort(nextSort) ? prev : sanitizeSort(nextSort)
    );
  }, []);

  // ----- URL sync (debounced query / sort <-> ?q= / ?sort=) -----
  // Bidirectional: typing updates the URL (debounced, replace history so
  // each keystroke isn't a back-button trap), and an external URL change
  // (e.g. a hashtag link in PostCard) updates the input. Sort follows the
  // same pattern so a "latest" view can be deep-linked.
  useEffect(() => {
    const currentQuery = sanitizeQuery(searchParams.get("q") || "");
    const currentSort = sanitizeSort(searchParams.get("sort") || "");
    if (currentQuery === activeQuery && currentSort === sort) return;

    const next = new URLSearchParams(searchParams);
    if (activeQuery) {
      next.set("q", activeQuery);
    } else {
      next.delete("q");
    }
    if (sort === SORT_LATEST) {
      next.set("sort", SORT_LATEST);
    } else {
      next.delete("sort");
    }
    setSearchParams(next, { replace: true });
  }, [activeQuery, sort, searchParams, setSearchParams]);

  // Reset the "view all" toggle and prime people-panel state whenever the
  // active query changes — otherwise expansion silently carries over and
  // the people skeleton wouldn't show on a fresh search. Done as a
  // render-time reset (React's recommended pattern) to avoid extra commit
  // cycles from effects.
  const [prevActiveQuery, setPrevActiveQuery] = useState(activeQuery);
  if (prevActiveQuery !== activeQuery) {
    setPrevActiveQuery(activeQuery);
    setPeopleExpanded(false);
    if (activeQuery) {
      setPeopleLoading(true);
    } else {
      setPeople([]);
      setPeopleLoading(false);
    }
  }

  // ----- Posts fetch (trending OR search) -----
  // The async work runs inline inside the effect so React can see that no
  // setState happens synchronously in the effect body. The `cancelled`
  // closure drops stale responses if the user types fast (older fetch
  // resolving after a newer one would otherwise overwrite fresh results).
  const [postsRetryToken, setPostsRetryToken] = useState(0);

  const retryPosts = useCallback(() => {
    setInitialLoading(true);
    setPostsError("");
    setPostsRetryToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const data = await postService.explorePosts({
          limit: EXPLORE_PAGE_LIMIT,
          q: activeQuery || undefined,
          sort: hasQuery ? undefined : sort,
        });
        if (cancelled) return;
        setPosts(Array.isArray(data?.items) ? data.items : []);
        setNextCursor(data?.nextCursor || null);
        setHasMore(Boolean(data?.hasMore));
        setPostsError("");
      } catch {
        if (cancelled) return;
        setPostsError("Couldn't load posts.");
        setPosts([]);
        setHasMore(false);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeQuery, hasQuery, sort, postsRetryToken]);

  // ----- Pagination -----
  const handleLoadMore = useCallback(async () => {
    if (paginating || !hasMore || !nextCursor) return;
    setPaginating(true);
    try {
      const data = await postService.explorePosts({
        cursor: nextCursor,
        limit: EXPLORE_PAGE_LIMIT,
        q: activeQuery || undefined,
        sort: hasQuery ? undefined : sort,
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
  }, [activeQuery, hasQuery, hasMore, nextCursor, paginating, sort]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    loading: paginating,
    onLoadMore: handleLoadMore,
    rootMargin: "400px",
  });

  // ----- Suggested people fetch (no query) -----
  // Re-runs when the viewer's identity changes so the server-side exclusion
  // of "people you already follow" stays in sync after a fresh login.
  const viewerKey = user?._id || "guest";
  useEffect(() => {
    let cancelled = false;
    setSuggestedLoading(true);
    setSuggestedError("");

    userService
      .getSuggestedUsers(SUGGESTED_PEOPLE_LIMIT)
      .then((data) => {
        if (cancelled) return;
        setSuggestedPeople(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (cancelled) return;
        setSuggestedPeople([]);
        setSuggestedError("Couldn't load suggestions.");
      })
      .finally(() => {
        if (!cancelled) setSuggestedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewerKey]);

  // ----- People fetch (only when there's a query) -----
  // The "no query" reset and the "loading=true" kickoff are handled in
  // the render-time sync above, so this effect's only job is the async
  // fetch — every setState here lives behind the await.
  useEffect(() => {
    if (!hasQuery) return undefined;

    let cancelled = false;
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
  const skeletonSuggestedPeople = useMemo(
    () =>
      Array.from({ length: SUGGESTED_PEOPLE_SKELETON_COUNT }, (_, idx) => (
        <UserCardSkeleton key={`explore-suggested-skel-${idx}`} />
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
          placeholder="Search posts or people"
          aria-label="Search posts or people"
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
                aria-label="Clear search"
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
              People
            </h2>
            {peopleHasMore && (
              <button
                type="button"
                onClick={() => setPeopleExpanded((value) => !value)}
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {peopleExpanded ? "Show less" : "See all"}
              </button>
            )}
          </header>

          {peopleLoading ? (
            <ul className="space-y-2" aria-busy="true" aria-live="polite">
              {skeletonPeople}
            </ul>
          ) : people.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              No people match this search.
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

      {/* ----- Suggested people (only when no active search) ----- */}
      {!hasQuery &&
        (suggestedLoading ||
          suggestedPeople.length > 0 ||
          Boolean(suggestedError)) && (
          <section
            aria-labelledby="explore-suggested-title"
            className="space-y-3 motion-safe:animate-fade-up"
          >
            <header className="space-y-1">
              <h2
                id="explore-suggested-title"
                className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50"
              >
                <Users
                  className="size-5 text-brand-500 dark:text-brand-400"
                  aria-hidden="true"
                />
                People to follow
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {user
                  ? "Fresh accounts you don't follow yet"
                  : "Popular accounts on Pulse"}
              </p>
            </header>

            {suggestedLoading ? (
              <ul className="space-y-2" aria-busy="true" aria-live="polite">
                {skeletonSuggestedPeople}
              </ul>
            ) : suggestedError ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                {suggestedError}
              </p>
            ) : (
              <ul className="space-y-2">
                {suggestedPeople.map((person) => (
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

      {/* ----- Sort tabs (only when no active search) ----- */}
      {!hasQuery && (
        <Tabs
          tabs={sortTabs}
          value={sort}
          onChange={handleSortChange}
          ariaLabel="Sort explore feed"
        />
      )}

      {/* ----- Posts header (Trending / Latest / Search results) ----- */}
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
                Posts
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Results for{" "}
                <span className="text-zinc-700 dark:text-zinc-200">
                  &quot;{activeQuery}&quot;
                </span>
              </p>
            </>
          ) : isLatest ? (
            <>
              <h2
                id="explore-posts-title"
                className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50"
              >
                <Clock
                  className="size-5 text-brand-500 dark:text-brand-400"
                  aria-hidden="true"
                />
                Latest posts
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Every post on Pulse, newest first
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
                Trending posts
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Standout posts from the last 90 days
              </p>
            </>
          )}
        </header>

        {postsError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <span>{postsError}</span>
            <Button variant="secondary" size="sm" onClick={retryPosts}>
              Try again
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
              title="No results found"
              description="Try searching with a different keyword."
            />
          ) : isLatest ? (
            <EmptyState
              icon={Clock}
              title="No posts yet"
              description="Be the first to share a post and kick things off."
              action={
                user
                  ? { label: "Create post", href: "/posts/new" }
                  : { label: "Sign in", href: "/login" }
              }
            />
          ) : (
            <EmptyState
              icon={Flame}
              title="Nothing trending yet"
              description="Try the Latest tab to see brand-new posts."
              action={
                user
                  ? { label: "Create post", href: "/posts/new" }
                  : { label: "Sign in", href: "/login" }
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
                  className="transition-all duration-base hover:-translate-y-0.5 hover:shadow-md motion-safe:animate-fade-up"
                >
                  {isTrending && index < TRENDING_BADGE_LIMIT && (
                    <div className="mb-1.5 flex items-center gap-1 px-1 text-2xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                      <Flame className="size-3" aria-hidden="true" />
                      <span>Trending</span>
                      <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                        ·
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400">
                        #{index + 1}
                      </span>
                    </div>
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
                <span>Loading more…</span>
              </div>
            )}
          </div>
        )}

        {showPostsList && !hasMore && (
          <p className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            You&apos;re all caught up
          </p>
        )}
      </section>

      {/* ----- Sign-in prompt (centered modal) ----- */}
      <Modal
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        title="Sign in to interact"
        description="You need an account to like, follow and comment on Pulse."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAuthPromptOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAuthPromptOpen(false);
                navigate("/register");
              }}
            >
              Sign up
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setAuthPromptOpen(false);
                navigate("/login");
              }}
            >
              Sign in
            </Button>
          </>
        }
      >
        <p>
          You&apos;ll be back instantly — your page position is preserved.
        </p>
      </Modal>
    </div>
  );
}
