/**
 * Sign — author signature shown at the bottom of every page.
 *
 * Always visible across breakpoints. On mobile it carries extra bottom
 * padding so the line never sits underneath the fixed tab bar in
 * `Navbar`. Keep this component lean and self-contained so any layout
 * (consumer, settings, admin, auth) can drop it in without extra wiring.
 */
export default function Sign({ className = "" }) {
  return (
    <div
      className={`border-t border-zinc-200 px-4 pb-20 pt-4 text-center text-xs text-zinc-500 sm:px-6 md:border-0 md:pb-4 dark:border-zinc-800 dark:text-zinc-400 ${className}`.trim()}
    >
      <p>
        Created by{" "}
        <a
          href="https://serkanbayraktar.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zinc-700 underline-offset-2 transition-colors duration-fast hover:text-brand-600 hover:underline dark:text-zinc-200 dark:hover:text-brand-400"
        >
          Serkanby
        </a>{" "}
        |{" "}
        <a
          href="https://github.com/Serkanbyx"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zinc-700 underline-offset-2 transition-colors duration-fast hover:text-brand-600 hover:underline dark:text-zinc-200 dark:hover:text-brand-400"
        >
          Github
        </a>
      </p>
    </div>
  );
}
