import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Grid3x3,
  ImageIcon,
  Lock,
  UserX,
} from "lucide-react";

import Banner from "../../components/ui/Banner.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import Tabs from "../../components/ui/Tabs.jsx";
import { ProfileHeaderSkeleton } from "../../components/ui/skeletons/index.js";

import PostGrid from "../../components/post/PostGrid.jsx";
import FollowButton from "../../components/user/FollowButton.jsx";
import ProfileHeader from "../../components/user/ProfileHeader.jsx";

import { useAuth } from "../../context/AuthContext.jsx";

import useDocumentTitle from "../../hooks/useDocumentTitle.js";
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js";

import * as postService from "../../services/postService.js";
import * as userService from "../../services/userService.js";

import { DEFAULT_PAGE_LIMIT } from "../../utils/constants.js";

/**
 * ProfilePage — public/owner profile surface (STEP 31).
 *
 * Outer wrapper is intentionally trivial: it reads the route param and
 * renders an inner view *keyed by username*. Remounting on username
 * change gives us fresh state for free — no manual reset block, no risk
 * of leaking the previous profile's posts/counters into a new one.
 *
 * Layout (top → bottom): header (banner + identity + counters) · tab
 * row (only "Posts" in MVP) · posts grid with infinite scroll. The
 * column sits at `max-w-2xl mx-auto` to inherit the MainLayout's
 * reading width — the responsive grid (1/2/3 columns) still works
 * comfortably inside that frame.
 *
 * Branches:
 *  - 404 / inactive account → friendly EmptyState ("This account is
 *    unavailable.").
 *  - Private account viewed by a non-follower → lock card in place of
 *    the grid with the Follow button repeated for one-click action.
 *  - Owner with zero posts → CTA to create the first post.
 *  - Other-user empty timeline → soft "@x hasn't posted anything."
 *
 * Real-time / future polish:
 *  - The follow button and grid stay decoupled; a follow change updates
 *    only the followers counter in local state — we never refetch the
 *    whole profile mid-interaction (would feel laggy).
 *  - When the spec wires up a `posts:new` socket event for a profile,
 *    this page will be the right place to surface a "new post" pill —
 *    same pattern the feed uses.
 */
export default function ProfilePage() {
  const { username } = useParams();
  if (!username) return null;
  return <ProfileView key={username.toLowerCase()} username={username} />;
}

function ProfileView({ username }) {
  const { user: viewer } = useAuth();
  const normalisedUsername = username.toLowerCase();

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [tab, setTab] = useState("posts");

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState("");
  const [postsHidden, setPostsHidden] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [paginating, setPaginating] = useState(false);

  const isOwner =
    Boolean(viewer) &&
    Boolean(profile) &&
    String(viewer._id) === String(profile._id);
  const isPrivate = Boolean(profile?.isPrivate);
  const canSeePosts = Boolean(profile) && (!isPrivate || isOwner || profile.isFollowing);

  useDocumentTitle(profile ? `@${profile.username}` : `@${normalisedUsername}`);

  // ----- Profile fetch -----
  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError("");
    setNotFound(false);
    try {
      const data = await userService.getUserByUsername(normalisedUsername);
      setProfile(data?.user || null);
      if (!data?.user) setNotFound(true);
    } catch (error) {
      if (error?.response?.status === 404) {
        setNotFound(true);
        setProfile(null);
      } else {
        setProfileError("Profil yüklenemedi.");
      }
    } finally {
      setProfileLoading(false);
    }
  }, [normalisedUsername]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ----- Posts fetch -----
  // Keyed by `canSeePosts`: the profile load determines whether the grid
  // even gets a chance to fetch. Private posts are hidden server-side
  // too (404 from `/posts/user/:username`) but skipping the request
  // keeps DevTools quiet and saves a round trip.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!profile || !canSeePosts) {
      setPosts([]);
      setPostsLoading(false);
      setHasMore(false);
      setNextCursor(null);
      setPostsHidden(!canSeePosts && Boolean(profile));
      return undefined;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    let cancelled = false;
    setPostsLoading(true);
    setPostsError("");
    setPostsHidden(false);

    postService
      .getPostsByUsername(normalisedUsername, undefined, DEFAULT_PAGE_LIMIT)
      .then((data) => {
        if (cancelled || requestIdRef.current !== requestId) return;
        const incoming = Array.isArray(data?.items) ? data.items : [];
        setPosts(incoming);
        setNextCursor(data?.nextCursor || null);
        setHasMore(Boolean(data?.hasMore));
      })
      .catch((error) => {
        if (cancelled || requestIdRef.current !== requestId) return;
        if (error?.response?.status === 404) {
          // Treat a 404 here as "no posts visible" — the profile already
          // confirmed the user exists, so this is almost certainly the
          // server's privacy gate.
          setPosts([]);
          setHasMore(false);
          setPostsHidden(true);
        } else {
          setPostsError("Gönderiler yüklenemedi.");
        }
      })
      .finally(() => {
        if (!cancelled && requestIdRef.current === requestId) {
          setPostsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile, canSeePosts, normalisedUsername]);

  // ----- Pagination -----
  const handleLoadMore = useCallback(async () => {
    if (paginating || !hasMore || !nextCursor) return;
    setPaginating(true);
    try {
      const data = await postService.getPostsByUsername(
        normalisedUsername,
        nextCursor,
        DEFAULT_PAGE_LIMIT
      );
      const incoming = Array.isArray(data?.items) ? data.items : [];
      setPosts((prev) => {
        const seen = new Set(prev.map((post) => post._id));
        const merged = incoming.filter((post) => !seen.has(post._id));
        return [...prev, ...merged];
      });
      setNextCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.hasMore));
    } catch {
      // Inline failure: stop pagination so the sentinel doesn't keep
      // hammering the network. Scrolling away/back will retry on the
      // next mount of the observer.
      setHasMore(false);
    } finally {
      setPaginating(false);
    }
  }, [hasMore, nextCursor, normalisedUsername, paginating]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    loading: paginating || postsLoading,
    onLoadMore: handleLoadMore,
    rootMargin: "320px",
  });

  // Manual posts retry — bumps the request id so any in-flight stale
  // promise is dropped, then re-fires the first page fetch. Used by the
  // inline error banner without re-running the whole effect chain.
  const retryPosts = useCallback(async () => {
    requestIdRef.current += 1;
    setPostsError("");
    setPostsLoading(true);
    try {
      const data = await postService.getPostsByUsername(
        normalisedUsername,
        undefined,
        DEFAULT_PAGE_LIMIT
      );
      const incoming = Array.isArray(data?.items) ? data.items : [];
      setPosts(incoming);
      setNextCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.hasMore));
    } catch {
      setPostsError("Gönderiler yüklenemedi.");
    } finally {
      setPostsLoading(false);
    }
  }, [normalisedUsername]);

  // ----- Header callbacks -----
  // Optimistically reflect a follow toggle in the local profile state so
  // the counter and the (re-rendered) lock card stay coherent without a
  // refetch. The server count, when present in the response, takes
  // precedence over the local +/-1 estimate.
  const handleFollowChange = useCallback((change) => {
    if (!change) return;
    setProfile((prev) => {
      if (!prev) return prev;
      const nextFollowing = Boolean(change.isFollowing);
      const baseCount =
        typeof change.followersCount === "number"
          ? change.followersCount
          : Math.max(
              0,
              (prev.followersCount || 0) +
                (nextFollowing ? 1 : -1) *
                  (Boolean(prev.isFollowing) === nextFollowing ? 0 : 1)
            );
      return {
        ...prev,
        isFollowing: nextFollowing,
        followersCount: baseCount,
      };
    });
  }, []);

  // ----- Derived render branches -----
  const tabs = useMemo(
    () => [{ id: "posts", label: "Gönderiler", icon: Grid3x3 }],
    []
  );

  const showInitialLoading = profileLoading;
  const showInactive = !profileLoading && profile && profile.isActive === false;
  const showNotFound = !profileLoading && (notFound || (!profile && !profileError));

  return (
    <div className="space-y-6">
      {showInitialLoading && (
        <ProfileHeaderSkeleton />
      )}

      {!showInitialLoading && profileError && (
        <Banner variant="danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{profileError}</span>
            <Button variant="secondary" size="sm" onClick={fetchProfile}>
              Tekrar dene
            </Button>
          </div>
        </Banner>
      )}

      {showNotFound && !profileError && (
        <EmptyState
          icon={UserX}
          title="Kullanıcı bulunamadı"
          description="Bu adreste bir hesap yok ya da kaldırılmış olabilir."
          action={{ label: "Keşfet'e git", href: "/explore" }}
        />
      )}

      {showInactive && (
        <EmptyState
          icon={UserX}
          title="Bu hesap kullanılamıyor"
          description="Hesap yönetici tarafından devre dışı bırakılmış."
          action={{ label: "Keşfet'e git", href: "/explore" }}
        />
      )}

      {!showInitialLoading && !showNotFound && !showInactive && profile && (
        <>
          <ProfileHeader
            user={profile}
            isOwner={isOwner}
            onFollowChange={handleFollowChange}
          />

          <Tabs
            tabs={tabs}
            value={tab}
            onChange={setTab}
            ariaLabel="Profil sekmeleri"
          />

          <section
            aria-label="Profil içeriği"
            className="motion-safe:animate-fade-up"
          >
            {/* ----- Private gate ----- */}
            {!canSeePosts && (
              <PrivateGate user={profile} onFollowChange={handleFollowChange} />
            )}

            {/* ----- Posts: loading / error / empty / list ----- */}
            {canSeePosts && postsError && !postsLoading && (
              <Banner variant="danger" className="mb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>{postsError}</span>
                  <Button variant="secondary" size="sm" onClick={retryPosts}>
                    Tekrar dene
                  </Button>
                </div>
              </Banner>
            )}

            {canSeePosts && postsLoading && <PostGrid.Skeleton count={6} />}

            {canSeePosts &&
              !postsLoading &&
              !postsError &&
              posts.length === 0 &&
              !postsHidden && (
                <EmptyState
                  icon={ImageIcon}
                  title={
                    isOwner
                      ? "Henüz bir gönderi paylaşmadın"
                      : `@${profile.username} henüz bir şey paylaşmamış`
                  }
                  description={
                    isOwner
                      ? "İlk paylaşımınla burayı şenlendirebilirsin."
                      : "Yeni bir şey paylaşıldığında burada görüneceksin."
                  }
                  action={
                    isOwner
                      ? { label: "Gönderi oluştur", href: "/posts/new" }
                      : undefined
                  }
                />
              )}

            {canSeePosts && !postsLoading && posts.length > 0 && (
              <PostGrid posts={posts} />
            )}

            {canSeePosts && !postsLoading && posts.length > 0 && hasMore && (
              <div ref={sentinelRef} className="pt-4">
                {paginating && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                    <Spinner size="md" />
                    <span>Daha fazla yükleniyor…</span>
                  </div>
                )}
              </div>
            )}

            {canSeePosts &&
              !postsLoading &&
              posts.length > 0 &&
              !hasMore &&
              !postsError && (
                <p className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-500 dark:text-zinc-400">
                  <CheckCircle2
                    className="size-4 text-emerald-500"
                    aria-hidden="true"
                  />
                  Tüm gönderileri gördün
                </p>
              )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * PrivateGate — friendly lock card shown when a non-follower views a
 * private profile. The Follow button is repeated here so the user can
 * unlock the timeline with a single tap, matching the "Follow to view"
 * affordance on Instagram / X.
 */
function PrivateGate({ user, onFollowChange }) {
  return (
    <div
      className={
        "flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900"
      }
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
        <Lock className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Bu hesap gizli
      </h2>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        @{user.username} kullanıcısının gönderilerini görmek için takip et.
      </p>

      <div className="mt-2 inline-flex">
        <FollowButton
          userId={user._id}
          isFollowing={Boolean(user.isFollowing)}
          size="md"
          onChange={onFollowChange}
        />
      </div>

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Daha fazlasını görmek için{" "}
        <Link
          to="/explore"
          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Keşfet
        </Link>
        &apos;i ziyaret edebilirsin.
      </p>
    </div>
  );
}
