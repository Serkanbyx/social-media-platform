import { useMemo } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import Navbar from "./Navbar.jsx";
import ScrollToTop from "./ScrollToTop.jsx";

const SECTIONS = [
  { to: "/settings/account", label: "Account" },
  { to: "/settings/appearance", label: "Appearance" },
  { to: "/settings/privacy", label: "Privacy" },
  { to: "/settings/notifications", label: "Notifications" },
];

const railClass = ({ isActive }) =>
  [
    "block rounded-md px-3 py-2 text-sm transition-colors duration-fast",
    isActive
      ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800/60 dark:text-zinc-100"
      : "text-zinc-600 hover:bg-zinc-100/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100",
  ].join(" ");

const segmentClass = ({ isActive }) =>
  [
    "shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors duration-fast",
    isActive
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700",
  ].join(" ");

/**
 * SettingsLayout — narrow two-column rail + content.
 *
 * On mobile the left rail collapses into a horizontally scrollable
 * segmented control above the content, mirroring the Admin layout's
 * pattern so the user only learns one mobile-collapse idiom.
 */
export default function SettingsLayout() {
  const { pathname } = useLocation();

  const currentLabel = useMemo(
    () => SECTIONS.find((s) => pathname.startsWith(s.to))?.label || "Account",
    [pathname]
  );

  return (
    <div className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <ScrollToTop />
      <Navbar />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 md:grid md:grid-cols-[200px_1fr] md:gap-8">
        <aside className="hidden md:block">
          <div className="sticky top-20">
            <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
              {SECTIONS.map((s) => (
                <NavLink key={s.to} to={s.to} className={railClass}>
                  {s.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex flex-col">
          <nav
            aria-label="Settings sections (mobile)"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-4 md:hidden"
          >
            {SECTIONS.map((s) => (
              <NavLink key={s.to} to={s.to} className={segmentClass}>
                {s.label}
              </NavLink>
            ))}
          </nav>

          <header className="mb-4 hidden md:block">
            <p className="text-xs text-zinc-500">Settings › {currentLabel}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{currentLabel}</h1>
          </header>

          <main id="main" tabIndex={-1} className="flex-1 pb-20 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
