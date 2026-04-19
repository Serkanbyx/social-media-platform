import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Monitor, Moon, Sun } from "lucide-react";

import { THEME_STORAGE_KEY } from "../../utils/constants.js";
import logoUrl from "../../assets/logo.svg";

/**
 * AuthShell — shared chrome for Login & Register.
 *
 * Layout:
 *  - On `lg:` two columns — left brand panel (gradient + logo + tagline),
 *    right form card centered in the viewport.
 *  - Below `lg:` collapses to one column with a small wordmark on top.
 *  - Sticky theme toggle in the top-right corner so a guest can dial in
 *    light/dark before they even create an account.
 *
 * Why a guest theme toggle exists separately from PreferencesContext:
 *  PreferencesContext is the source of truth for *signed in* users
 *  (preferences live on the server). Guests have no profile yet, so the
 *  shell maintains a localStorage-backed override that flips the `dark`
 *  class on `<html>` directly. Once the user signs in, PreferencesContext
 *  takes over from the server-side preference and supersedes it.
 */

const THEMES = ["system", "light", "dark"];

const computeIsDark = (mode) => {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
};

const readStoredTheme = () => {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return THEMES.includes(value) ? value : "system";
};

function GuestThemeToggle() {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", computeIsDark(theme));
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme !== "system") return undefined;
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mql) return undefined;
    const onChange = () =>
      document.documentElement.classList.toggle("dark", mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const cycle = useCallback(() => {
    setTheme((prev) => THEMES[(THEMES.indexOf(prev) + 1) % THEMES.length]);
  }, []);

  const Icon = theme === "dark" ? Sun : theme === "light" ? Moon : Monitor;
  const label =
    theme === "system"
      ? "Theme: system"
      : theme === "light"
      ? "Theme: light"
      : "Theme: dark";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${label}. Click to change.`}
      className="inline-flex size-9 items-center justify-center rounded-full bg-white/80 text-zinc-700 shadow-xs ring-1 ring-zinc-200 backdrop-blur transition-colors duration-fast hover:bg-white hover:text-zinc-900 dark:bg-zinc-900/70 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-900"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function BrandPanel() {
  return (
    <aside
      aria-hidden="true"
      className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 to-brand-800 lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-white"
    >
      <svg
        className="pointer-events-none absolute inset-0 size-full opacity-15"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="auth-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 32 V0 H32"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>

      <div
        className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-16 size-96 rounded-full bg-brand-400/20 blur-3xl"
        aria-hidden="true"
      />

      <Link to="/" className="relative z-10 inline-flex items-center text-white">
        <img src={logoUrl} alt="Pulse" className="h-8 w-auto" />
      </Link>

      <div className="relative z-10 max-w-md space-y-4">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          Connect, share, discover.
        </h1>
        <p className="text-base text-brand-100/90">
          Pulse is a minimal social space that keeps you in real-time touch
          with the people you care about.
        </p>
        <ul className="space-y-2 text-sm text-brand-100/80">
          <li className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-white/80" aria-hidden="true" />
            An ad-free, distraction-light feed
          </li>
          <li className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-white/80" aria-hidden="true" />
            Real-time notifications and live engagement
          </li>
          <li className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-white/80" aria-hidden="true" />
            Light and dark theme support
          </li>
        </ul>
      </div>

      <p className="relative z-10 text-xs text-brand-100/70">
        © {new Date().getFullYear()} Pulse
      </p>
    </aside>
  );
}

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="absolute right-4 top-4 z-20">
        <GuestThemeToggle />
      </div>

      <BrandPanel />

      <main className="flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:py-16">
        <div className="w-full max-w-md">
          <Link
            to="/"
            aria-label="Pulse home"
            className="mb-8 inline-flex items-center text-brand-600 lg:hidden dark:text-brand-400"
          >
            <img src={logoUrl} alt="Pulse" className="h-7 w-auto" />
          </Link>

          <section
            aria-labelledby="auth-title"
            className="motion-safe:animate-fade-up rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-10 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <header className="mb-6 space-y-1.5">
              <h2
                id="auth-title"
                className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {subtitle}
                </p>
              )}
            </header>

            {children}
          </section>

          {footer && (
            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {footer}
            </p>
          )}

          <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            By continuing, you agree to our{" "}
            <a
              href="#"
              className="underline decoration-dotted underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Terms of Service
            </a>
            .
          </p>

          <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Created by{" "}
            <a
              href="https://serkanbayraktar.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-600 underline-offset-2 hover:text-brand-600 hover:underline dark:text-zinc-300 dark:hover:text-brand-400"
            >
              Serkanby
            </a>{" "}
            |{" "}
            <a
              href="https://github.com/Serkanbyx"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-600 underline-offset-2 hover:text-brand-600 hover:underline dark:text-zinc-300 dark:hover:text-brand-400"
            >
              Github
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
