import { ExternalLink } from "lucide-react";

import Sign from "./Sign.jsx";

const FOOTER_LINKS = [
  { href: "#", label: "About" },
  { href: "#", label: "Privacy" },
  { href: "#", label: "Terms" },
];

/**
 * Footer — minimal, single-line on desktop with an always-visible author
 * signature row underneath. The richer link strip is hidden on mobile to
 * avoid clutter beside the fixed bottom tab bar, but the `Sign` line is
 * shown on every breakpoint with extra bottom spacing on small screens
 * so it never gets obscured by the tab bar.
 */
export default function Footer() {
  return (
    <footer className="mt-12 border-t border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
      <div className="mx-auto hidden max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 sm:flex-row sm:px-6 md:flex">
        <p>
          Pulse · © {new Date().getFullYear()} — one feeling, one post at a time.
        </p>
        <ul className="flex items-center gap-4">
          {FOOTER_LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="transition-colors duration-fast hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="GitHub repository"
              className="inline-flex items-center gap-1 transition-colors duration-fast hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              GitHub
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </li>
        </ul>
      </div>

      <Sign />
    </footer>
  );
}
