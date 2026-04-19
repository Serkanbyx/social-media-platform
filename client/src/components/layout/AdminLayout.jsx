import { useMemo } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  Users,
} from "lucide-react";

import Footer from "./Footer.jsx";
import Navbar from "./Navbar.jsx";
import ScrollToTop from "./ScrollToTop.jsx";

const NAV = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/posts", label: "Posts", icon: Newspaper },
  { to: "/admin/comments", label: "Comments", icon: MessageSquare },
];

const itemClass = ({ isActive }) =>
  [
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-fast",
    isActive
      ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
  ].join(" ");

const mobileItemClass = ({ isActive }) =>
  [
    "shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors duration-fast",
    isActive
      ? "bg-brand-600 text-white dark:bg-brand-500"
      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
  ].join(" ");

/**
 * AdminLayout — two-column admin chrome.
 *   sidebar (lg+) · main with breadcrumb + outlet.
 *
 * Below `lg`, the sidebar collapses into a horizontal scrollable rail at
 * the top of the page so we don't need a separate drawer component.
 */
export default function AdminLayout() {
  const { pathname } = useLocation();

  const currentLabel = useMemo(() => {
    const match = NAV.find((item) =>
      item.end ? pathname === item.to : pathname.startsWith(item.to)
    );
    return match ? match.label : "Dashboard";
  }, [pathname]);

  return (
    <div className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <ScrollToTop />
      <Navbar />

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="px-2 pb-2 text-2xs font-semibold uppercase tracking-wide text-zinc-500">
              Admin
            </p>
            <nav aria-label="Admin navigation" className="flex flex-col gap-0.5">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={itemClass}>
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex flex-col">
          <nav
            aria-label="Admin navigation (mobile)"
            className="sticky top-14 z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-zinc-200 bg-white/85 px-4 py-3 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/85"
          >
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={mobileItemClass}>
                {label}
              </NavLink>
            ))}
          </nav>

          <header className="mb-4">
            <p className="text-xs text-zinc-500">Admin › {currentLabel}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{currentLabel}</h1>
          </header>

          <main id="main" tabIndex={-1} className="flex-1 pb-20 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
