import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Lock,
  Search,
  SearchX,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";

import Avatar from "../../components/ui/Avatar.jsx";
import Banner from "../../components/ui/Banner.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import IconButton from "../../components/ui/IconButton.jsx";
import Input from "../../components/ui/Input.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import Tabs from "../../components/ui/Tabs.jsx";
import { UserCardSkeleton } from "../../components/ui/skeletons/index.js";

import UserCard from "../../components/user/UserCard.jsx";

import { useAuth } from "../../context/useAuth.js";

import useDebounce from "../../hooks/useDebounce.js";
import useDocumentTitle from "../../hooks/useDocumentTitle.js";
import useInfiniteScroll from "../../hooks/useInfiniteScroll.js";

import * as userService from "../../services/userService.js";

import { cn } from "../../utils/cn.js";
import compactCount from "../../utils/formatCount.js";
import {
  FOLLOW_LIST_PAGE_LIMIT,
  SEARCH_DEBOUNCE_MS,
} from "../../utils/constants.js";

/**
 * FollowListView — shared inner component for the Followers / Following
 * pages (STEP 33). The route-level pages are tiny shells that mount this
 * with the appropriate `tab` prop, so the entire surface (header strip,
 * tab switcher, sticky search, list, infinite scroll, empty states and
 * the row-remove animation) lives in one place.
 *
 * Why a shared inner view rather than one component per route:
 *  - Tab counts, the mini-profile strip and the search/empty branches
 *    are identical across both tabs.
 *  - Switching tabs is a real navigation (URL changes) so deep links
 *    keep working, but the visual entrance still uses the same fade-up
 *    animation in both directions.
 *
 * Privacy & auth:
 *  - Private profiles return 403 server-side for non-followers; we map
 *    that to a friendly "This account is private" gate.
 *  - Anonymous viewers can browse a public account's lists, but tapping
 *    Follow opens the centred sign-in prompt (same UX as Explore).
 *
 * Search:
 *  - Debounced (300 ms), client-side filter on already-loaded items by
 *    `username` or display `name`. The server doesn't expose `?q=` for
 *    these endpoints, and we deliberately don't synthesise one — the
 *    list is small enough per page that local filtering is instant and
 *    free of network races.
 *
 * Row-remove animation (Following tab, owner only):
 *  - Unfollowing on your own Following tab visually shrinks the row out
 *    before it's spliced from local state, matching the "you removed
 *    them" affordance on every major social platform.
 */

const REMOVE_ANIMATION_MS = 220;

export default function FollowListView({ tab }) {
  const { username } = useParams();
  if (!username) return null;

  // Remount on username/tab change so we get fresh state for free —
  // no manual reset block, no stale rows leaking between profiles.
  const safeTab = tab === "following" ? "following" : "followers";
  return (
    <FollowListInner
      key={`${username.toLowerCase()}-${safeTab}`}
      username={username}
      tab={safeTab}
    />
  );
}

function FollowListInner({ username, tab }) {
  const navigate = useNavigate();
  const { user: viewer } = useAuth();
  const normalisedUsername = username.toLowerCase();

  // ----- Profile (mini strip + tab counts + privacy / not-found gates) -----
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [notFound, setNotFound] = useState(false);

  // ----- List state -----
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [paginating, setPaginating] = useState(false);

  // Ids currently animating out before being spliced from `items`.
  const [removingIds, setRemovingIds] = useState(() => new Set());

  // ----- Search -----
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query.trim().toLowerCase(), SEARCH_DEBOUNCE_MS);
  const pendingDebounce = query.trim().toLowerCase() !== debouncedQuery;

  // ----- Auth prompt (for guests trying to follow) -----
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  const isOwner =
    Boolean(viewer) &&
    Boolean(profile) &&
    String(viewer._id) === String(profile._id);

  const tabLabel = tab === "followers" ? "Takipçiler" : "Takip edilen";
  useDocumentTitle(
    profile
      ? `@${profile.username} · ${tabLabel}`
      : `@${normalisedUsername} · ${tabLabel}`
  );

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

  // ----- List fetch -----
  // Stale-response guard: a slow first-page request that resolves after a
  // newer one would otherwise overwrite fresh data. The request id keeps
  // only the latest in-flight response.
  const requestIdRef = useRef(0);

  const fetchList = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setListLoading(true);
    setListError("");
    setForbidden(false);

    try {
      const fn =
        tab === "followers" ? userService.getFollowers : userService.getFollowing;
      const data = await fn(normalisedUsername, undefined, FOLLOW_LIST_PAGE_LIMIT);
      if (requestIdRef.current !== requestId) return;
      const incoming = Array.isArray(data?.items) ? data.items : [];
      setItems(incoming);
      setNextCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.hasMore));
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      const status = error?.response?.status;
      if (status === 403) {
        setForbidden(true);
        setItems([]);
        setHasMore(false);
      } else if (status === 404) {
        // Profile fetch will surface the proper 404 EmptyState — list
        // simply has nothing to show in the meantime.
        setItems([]);
        setHasMore(false);
      } else {
        setListError("Liste yüklenemedi.");
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setListLoading(false);
      }
    }
  }, [normalisedUsername, tab]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ----- Pagination -----
  const handleLoadMore = useCallback(async () => {
    if (paginating || !hasMore || !nextCursor) return;
    setPaginating(true);
    try {
      const fn =
        tab === "followers" ? userService.getFollowers : userService.getFollowing;
      const data = await fn(normalisedUsername, nextCursor, FOLLOW_LIST_PAGE_LIMIT);
      const incoming = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => {
        const known = new Set(prev.map((row) => row._id));
        return [...prev, ...incoming.filter((row) => !known.has(row._id))];
      });
      setNextCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.hasMore));
    } catch {
      // Inline failure: stop paginating so the sentinel doesn't keep
      // hammering the network. The user can scroll away/back to retry.
      setHasMore(false);
    } finally {
      setPaginating(false);
    }
  }, [hasMore, nextCursor, normalisedUsername, paginating, tab]);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    loading: paginating || listLoading,
    onLoadMore: handleLoadMore,
    rootMargin: "320px",
  });

  // ----- Per-row follow toggle -----
  // Always reflect the new follow state in the local row so the button
  // morphs without a refetch. On the *owner's* Following tab we also
  // animate-out and remove rows when they're unfollowed, matching the
  // Twitter/Instagram "you just removed them" affordance.
  const handleFollowChange = useCallback(
    ({ userId, isFollowing, followersCount }) => {
      if (!userId) return;

      setItems((prev) =>
        prev.map((row) =>
          String(row._id) === String(userId)
            ? { ...row, isFollowing: Boolean(isFollowing) }
            : row
        )
      );

      // Keep the cached profile counts coherent with the toggle: if you
      // (un)follow the *page owner* themselves while on their list, bump
      // their followersCount up/down by one.
      if (profile && String(userId) === String(profile._id)) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: Boolean(isFollowing),
                followersCount:
                  typeof followersCount === "number"
                    ? followersCount
                    : Math.max(
                        0,
                        (prev.followersCount || 0) + (isFollowing ? 1 : -1)
                      ),
              }
            : prev
        );
      }

      const shouldAnimateRemove =
        isOwner && tab === "following" && !isFollowing;
      if (!shouldAnimateRemove) return;

      const idStr = String(userId);
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.add(idStr);
        return next;
      });

      window.setTimeout(() => {
        setItems((prev) => prev.filter((row) => String(row._id) !== idStr));
        setRemovingIds((prev) => {
          if (!prev.has(idStr)) return prev;
          const next = new Set(prev);
          next.delete(idStr);
          return next;
        });
        // Mirror the change in the cached `followingCount` so the tab
        // label stays in step with what the user sees.
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                followingCount: Math.max(0, (prev.followingCount || 0) - 1),
              }
            : prev
        );
      }, REMOVE_ANIMATION_MS);
    },
    [isOwner, profile, tab]
  );

  const handleRequireAuth = useCallback(() => setAuthPromptOpen(true), []);

  // ----- Search filter (client-side, on already-loaded items) -----
  const filteredItems = useMemo(() => {
    if (!debouncedQuery) return items;
    return items.filter((row) => {
      const handle = (row.username || "").toLowerCase();
      const display = (row.name || "").toLowerCase();
      return handle.includes(debouncedQuery) || display.includes(debouncedQuery);
    });
  }, [items, debouncedQuery]);

  // ----- Tabs -----
  const tabs = useMemo(
    () => [
      {
        id: "followers",
        label: `Takipçi · ${compactCount(profile?.followersCount ?? 0)}`,
        icon: Users,
      },
      {
        id: "following",
        label: `Takip · ${compactCount(profile?.followingCount ?? 0)}`,
        icon: UserCheck,
      },
    ],
    [profile?.followersCount, profile?.followingCount]
  );

  const handleTabChange = useCallback(
    (id) => {
      if (id === tab) return;
      navigate(`/u/${normalisedUsername}/${id}`);
    },
    [navigate, normalisedUsername, tab]
  );

  // ----- Search input handlers -----
  const handleQueryChange = (event) => {
    setQuery(event.target.value);
  };
  const handleClearQuery = useCallback(() => setQuery(""), []);
  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape" && query.length > 0) {
      event.preventDefault();
      handleClearQuery();
    }
  };

  // ----- Skeleton row factory -----
  const skeletonRows = useMemo(
    () =>
      Array.from({ length: 6 }, (_, idx) => (
        <UserCardSkeleton key={`follow-list-skel-${idx}`} />
      )),
    []
  );

  // ----- Branch: profile not found / inactive -----
  const showNotFound =
    !profileLoading && (notFound || (!profile && !profileError));
  const showInactive =
    !profileLoading && profile && profile.isActive === false;

  if (showNotFound) {
    return (
      <EmptyState
        icon={UserX}
        title="Kullanıcı bulunamadı"
        description="Bu adreste bir hesap yok ya da kaldırılmış olabilir."
        action={{ label: "Keşfet'e git", href: "/explore" }}
      />
    );
  }

  if (showInactive) {
    return (
      <EmptyState
        icon={UserX}
        title="Bu hesap kullanılamıyor"
        description="Hesap yönetici tarafından devre dışı bırakılmış."
        action={{ label: "Keşfet'e git", href: "/explore" }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ----- Mini profile strip ----- */}
      <header className="flex items-center gap-3 motion-safe:animate-fade-up">
        <IconButton
          as={Link}
          to={`/u/${normalisedUsername}`}
          icon={ArrowLeft}
          size="sm"
          variant="ghost"
          aria-label={`@${normalisedUsername} profiline dön`}
        />
        {profileLoading || !profile ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <span className="h-3 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ) : (
          <Link
            to={`/u/${profile.username}`}
            className="flex min-w-0 items-center gap-2 rounded-md transition-colors duration-fast hover:opacity-90"
          >
            <Avatar
              src={profile.avatar?.url}
              name={profile.name}
              username={profile.username}
              size="sm"
            />
            <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              @{profile.username}
            </span>
          </Link>
        )}
      </header>

      {profileError && (
        <Banner variant="danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{profileError}</span>
            <Button variant="secondary" size="sm" onClick={fetchProfile}>
              Tekrar dene
            </Button>
          </div>
        </Banner>
      )}

      {/* ----- Tabs ----- */}
      <Tabs
        tabs={tabs}
        value={tab}
        onChange={handleTabChange}
        ariaLabel="Takipçi ve takip sekmeleri"
      />

      {/* ----- Sticky search ----- */}
      <div
        role="search"
        className={cn(
          "sticky top-14 z-10 -mx-4 bg-white/85 px-4 py-2 backdrop-blur",
          "sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none",
          "dark:bg-zinc-950/85 sm:dark:bg-transparent"
        )}
      >
        <Input
          type="search"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleSearchKeyDown}
          maxLength={80}
          placeholder={
            tab === "followers"
              ? "Takipçilerde ara"
              : "Takip edilenlerde ara"
          }
          aria-label={
            tab === "followers"
              ? "Takipçilerde ara"
              : "Takip edilenlerde ara"
          }
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

      {/* ----- Body ----- */}
      <section
        key={tab}
        aria-live="polite"
        className="motion-safe:animate-fade-up"
      >
        {forbidden ? (
          <PrivateGate username={profile?.username || normalisedUsername} />
        ) : listError ? (
          <Banner variant="danger">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{listError}</span>
              <Button variant="secondary" size="sm" onClick={fetchList}>
                Tekrar dene
              </Button>
            </div>
          </Banner>
        ) : listLoading ? (
          <ul className="space-y-2" aria-busy="true">
            {skeletonRows}
          </ul>
        ) : items.length === 0 ? (
          renderEmpty({ tab, isOwner, username: profile?.username || normalisedUsername })
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Sonuç bulunamadı"
            description={`"${query.trim()}" ile eşleşen kimse yok.`}
          />
        ) : (
          <>
            <ul className="space-y-2">
              {filteredItems.map((row) => {
                const removing = removingIds.has(String(row._id));
                return (
                  <UserCard
                    key={row._id}
                    user={row}
                    onFollowChange={handleFollowChange}
                    onRequireAuth={handleRequireAuth}
                    className={cn(
                      "transition-all duration-200 will-change-transform",
                      removing &&
                        "pointer-events-none -translate-y-1 scale-95 opacity-0"
                    )}
                  />
                );
              })}
            </ul>

            {hasMore && (
              <div ref={sentinelRef} className="pt-2">
                {paginating && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                    <Spinner size="md" />
                    <span>Daha fazla yükleniyor…</span>
                  </div>
                )}
              </div>
            )}

            {!hasMore && items.length > 0 && !debouncedQuery && (
              <p className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Listenin sonuna geldin
              </p>
            )}
          </>
        )}
      </section>

      {/* ----- Sign-in prompt for anonymous Follow taps ----- */}
      <Modal
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        title="Takip etmek için giriş yap"
        description="Bir hesap aç ya da giriş yap; takip ettiklerin akışında belirir."
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
        <p>Hesabınla anında geri döneceksin — bulunduğun konum korunur.</p>
      </Modal>
    </div>
  );
}

/**
 * renderEmpty — pick the right "no rows" state for the active tab and
 * the viewer's relationship to the profile owner. Keeping this as a
 * standalone helper (rather than a JSX block in the body) keeps the
 * main render readable.
 */
function renderEmpty({ tab, isOwner, username }) {
  if (tab === "followers") {
    if (isOwner) {
      return (
        <EmptyState
          icon={Users}
          title="Henüz takipçin yok"
          description="İlk gönderini paylaşarak fark edilmeye başla."
          action={{ label: "Gönderi oluştur", href: "/posts/new" }}
        />
      );
    }
    return (
      <EmptyState
        icon={Users}
        title={`@${username} kullanıcısının takipçisi yok`}
        description="İlk takipçi sen olabilirsin."
      />
    );
  }

  if (isOwner) {
    return (
      <EmptyState
        icon={UserPlus}
        title="Henüz kimseyi takip etmiyorsun"
        description="Keşfet sayfasından ilgini çeken hesapları bul."
        action={{ label: "Keşfet'e git", href: "/explore" }}
      />
    );
  }
  return (
    <EmptyState
      icon={UserPlus}
      title={`@${username} kimseyi takip etmiyor`}
      description="Yeni hesapları takip ettiğinde burada görünecekler."
    />
  );
}

/**
 * PrivateGate — friendly notice when the viewer isn't allowed to see a
 * private account's social graph. The owner / approved followers never
 * land here; the server returns 403 only for outsiders.
 */
function PrivateGate({ username }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-center",
        "dark:border-zinc-800 dark:bg-zinc-900"
      )}
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
        <Lock className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Bu hesap gizli
      </h2>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        @{username} kullanıcısının takip listesini görmek için takip etmen gerek.
      </p>
      <Button as={Link} to={`/u/${username}`} variant="secondary" size="sm">
        Profile dön
      </Button>
    </div>
  );
}
