import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  Compass,
  Home,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Shield,
  Sun,
  User as UserIcon,
  X,
} from "lucide-react";

import { useAuth } from "../../context/useAuth.js";
import { useNotifications } from "../../context/useNotifications.js";
import { usePreferences } from "../../context/usePreferences.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import * as userService from "../../services/userService.js";
import { SEARCH_DEBOUNCE_MS } from "../../utils/constants.js";
import logoUrl from "../../assets/logo.svg";
import Avatar from "../ui/Avatar.jsx";
import NotificationBell from "../notification/NotificationBell.jsx";

/**
 * Navbar — top bar on every viewport plus a mobile-only bottom tab bar.
 *
 * Composition rationale:
 *  - All navigation surface lives here so layouts (Main/Settings/Admin)
 *    don't reimplement primary nav.
 *  - The user dropdown and search popover share a single
 *    "click-outside / ESC closes" effect so behavior stays consistent.
 *  - On mobile the bottom tab bar is the primary navigation; the top bar
 *    drops to a slimmer version (logo + bell + avatar). Search opens a
 *    full-screen overlay to honor a typical social app pattern.
 *
 * Note on theme toggle: we cycle through system → light → dark so the
 * user can always reach "follow OS" without digging into Settings.
 */
const navLinkClass = ({ isActive }) =>
  [
    "relative inline-flex items-center px-1 py-2 text-sm font-medium transition-colors duration-fast",
    isActive
      ? "text-brand-700 dark:text-brand-300"
      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
    isActive
      ? "after:absolute after:inset-x-0 after:-bottom-[1px] after:h-0.5 after:rounded-full after:bg-brand-600 dark:after:bg-brand-400"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

const tabClass = ({ isActive }) =>
  [
    "relative flex flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1 text-2xs transition-colors duration-fast",
    isActive
      ? "text-brand-700 dark:text-brand-300"
      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
  ].join(" ");

function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -right-1 -top-1 inline-flex min-w-[1.05rem] items-center justify-center rounded-full bg-rose-500 px-1 text-2xs font-semibold leading-4 text-white ring-2 ring-white dark:ring-zinc-950">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SearchResults({ query, results, loading, onPick }) {
  if (!query) {
    return (
      <p className="px-4 py-6 text-center text-xs text-zinc-500">
        Start typing to search
      </p>
    );
  }

  if (loading) {
    return (
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-2.5">
            <span className="skeleton size-8 rounded-full" />
            <span className="flex-1 space-y-1.5">
              <span className="skeleton block h-3 w-2/3" />
              <span className="skeleton block h-3 w-1/3" />
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (!results.length) {
    return (
      <p className="px-4 py-6 text-center text-xs text-zinc-500">
        No results for “{query}”
      </p>
    );
  }

  return (
    <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
      {results.map((u) => (
        <li key={u._id || u.username}>
          <Link
            to={`/u/${u.username}`}
            onClick={() => onPick?.(u)}
            className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-fast hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
          >
            <Avatar
              src={u.avatar}
              name={u.name}
              username={u.username}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {u.name || u.username}
              </span>
              <span className="block truncate text-xs text-zinc-500">
                @{u.username}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SearchPopover({ open, onClose, fullScreen = false }) {
  if (!open) return null;
  return (
    <SearchPopoverInner onClose={onClose} fullScreen={fullScreen} />
  );
}

/**
 * Inner component lives behind an `open` gate so its state is created
 * fresh each time the popover is opened and discarded on close — no
 * manual reset effects needed (which would also trip the
 * `react-hooks/set-state-in-effect` rule).
 */
function SearchPopoverInner({ onClose, fullScreen }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = debouncedQuery.trim();
    if (!term) return undefined;

    let cancelled = false;
    // Immediate loading feedback for the typeahead. The data-fetching
    // case is the standard exception for `react-hooks/set-state-in-effect`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    userService
      .searchUsers(term)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data?.items || data?.users || [];
        setResults(list.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  if (fullScreen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search users"
        className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-zinc-950"
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <Search
            className="size-4 text-zinc-400"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
            className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-zinc-400"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded-md p-1.5 text-zinc-500 transition-colors duration-fast hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SearchResults
            query={debouncedQuery.trim()}
            results={results}
            loading={loading}
            onPick={onClose}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute left-0 right-0 top-full mt-2 origin-top animate-modal-in overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <SearchResults
        query={debouncedQuery.trim()}
        results={results}
        loading={loading}
        onPick={onClose}
      />
    </div>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const { theme, updatePreference } = usePreferences();

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cycleTheme = async () => {
    const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    try {
      await updatePreference("theme", next);
    } catch {
      // PreferencesContext rolls back on failure; nothing else to do here.
    }
  };

  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const themeLabel =
    theme === "system" ? "System theme" : theme === "dark" ? "Light theme" : "Dark theme";

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full ring-offset-2 ring-offset-white transition-transform duration-fast motion-safe:active:scale-95 dark:ring-offset-zinc-950"
      >
        <Avatar
          src={user.avatar}
          name={user.name}
          username={user.username}
          size="sm"
        />
        <span className="sr-only">Open account menu</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-60 origin-top-right animate-modal-in overflow-hidden rounded-xl bg-white py-1 shadow-md ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
        >
          <Link
            to={`/u/${user.username}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-fast hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
          >
            <Avatar
              src={user.avatar}
              name={user.name}
              username={user.username}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {user.name || user.username}
              </span>
              <span className="block truncate text-xs text-zinc-500">
                @{user.username}
              </span>
            </span>
          </Link>

          <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />

          <Link
            to="/settings/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors duration-fast hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
          >
            <SettingsIcon className="size-4 text-zinc-500" aria-hidden="true" />
            Settings
          </Link>

          {user.role === "admin" && (
            <Link
              to="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors duration-fast hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <Shield className="size-4 text-zinc-500" aria-hidden="true" />
              Admin panel
            </Link>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={cycleTheme}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors duration-fast hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
          >
            <ThemeIcon className="size-4 text-zinc-500" aria-hidden="true" />
            {themeLabel}
            <span className="ml-auto text-2xs uppercase tracking-wide text-zinc-400">
              {theme}
            </span>
          </button>

          <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 transition-colors duration-fast hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const searchWrapperRef = useRef(null);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (!desktopSearchOpen) return undefined;
    const onClick = (e) => {
      if (!searchWrapperRef.current?.contains(e.target)) {
        setDesktopSearchOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setDesktopSearchOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [desktopSearchOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Index route renders FeedPage for signed-in users and LandingPage for
  // guests. Reflect that in the label so the desktop nav doesn't promise
  // a "Feed" surface to a visitor who isn't actually signed in yet.
  const desktopNav = useMemo(
    () => [
      { to: "/", label: user ? "Feed" : "Home", end: true },
      { to: "/explore", label: "Explore" },
    ],
    [user]
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="Pulse home"
            className="text-brand-600 transition-transform duration-fast hover:scale-[1.03] dark:text-brand-400"
          >
            <img src={logoUrl} alt="Pulse" className="hidden h-7 w-auto md:block" />
            <img
              src={logoUrl}
              alt="Pulse"
              className="block h-7 w-auto md:hidden"
              style={{ clipPath: "inset(0 64% 0 0)" }}
            />
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {desktopNav.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div
              ref={searchWrapperRef}
              className="relative hidden md:block md:w-64"
            >
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <input
                type="search"
                onFocus={() => setDesktopSearchOpen(true)}
                placeholder="Search users…"
                aria-label="Search users"
                className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-3 text-sm placeholder:text-zinc-400 transition-colors duration-fast focus:border-brand-300 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-brand-700 dark:focus:bg-zinc-900"
                onChange={() => setDesktopSearchOpen(true)}
              />
              <SearchPopover
                open={desktopSearchOpen}
                onClose={() => setDesktopSearchOpen(false)}
              />
            </div>

            <button
              type="button"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search users"
              className="inline-flex size-9 items-center justify-center rounded-full text-zinc-600 transition-colors duration-fast hover:bg-zinc-100 hover:text-zinc-900 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Search className="size-5" aria-hidden="true" />
            </button>

            {user && <NotificationBell />}

            {user ? (
              <UserMenu user={user} onLogout={handleLogout} />
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  to="/login"
                  className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors duration-fast hover:bg-zinc-100 sm:inline-flex dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-xs transition-colors duration-fast hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <SearchPopover
        open={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        fullScreen
      />

      {user && (
        <nav
          aria-label="Mobile navigation"
          className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-stretch border-t border-zinc-200 bg-white/95 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
        >
          <NavLink to="/" end className={tabClass} aria-label="Feed">
            <Home className="size-5" aria-hidden="true" />
            Feed
          </NavLink>
          <NavLink to="/explore" className={tabClass} aria-label="Explore">
            <Compass className="size-5" aria-hidden="true" />
            Explore
          </NavLink>
          <NavLink
            to="/posts/new"
            aria-label="New post"
            className="-mt-5 flex w-14 items-center justify-center"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-md transition-transform duration-fast hover:bg-brand-700 motion-safe:active:scale-95 dark:bg-brand-500 dark:hover:bg-brand-400">
              <Plus className="size-5" aria-hidden="true" />
            </span>
          </NavLink>
          <NavLink to="/notifications" className={tabClass} aria-label="Notifications">
            <span className="relative">
              <Bell className="size-5" aria-hidden="true" />
              <UnreadBadge count={unreadCount} />
            </span>
            Notifications
          </NavLink>
          <NavLink
            to={`/u/${user.username}`}
            className={tabClass}
            aria-label="My profile"
          >
            <UserIcon className="size-5" aria-hidden="true" />
            Profile
          </NavLink>
        </nav>
      )}
    </>
  );
}
