import { ExternalLink } from "lucide-react";

const FOOTER_LINKS = [
  { href: "#", label: "About" },
  { href: "#", label: "Privacy" },
  { href: "#", label: "Terms" },
];

/**
 * Footer — minimal, single-line on desktop. Hidden on mobile because the
 * bottom tab bar would otherwise overlap it; that's also why the parent
 * `MainLayout` adds bottom padding only on small screens.
 */
export default function Footer() {
  return (
    <footer className="mt-12 hidden border-t border-zinc-200 py-6 text-xs text-zinc-500 md:block dark:border-zinc-800">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
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
    </footer>
  );
}
