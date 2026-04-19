import { Link } from "react-router-dom";
import { Compass, Home } from "lucide-react";

/**
 * NotFoundPage — 404 fallback rendered for any unknown route under
 * `MainLayout`. Links back to the two anchor surfaces (feed + explore)
 * so the user always has a calm next step.
 */
export default function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        The page you're looking for may have moved, been deleted, or never existed.
      </p>

      <div className="mt-6 flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors duration-fast hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          <Home className="size-4" aria-hidden="true" />
          Back to feed
        </Link>
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors duration-fast hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <Compass className="size-4" aria-hidden="true" />
          Explore
        </Link>
      </div>
    </section>
  );
}
