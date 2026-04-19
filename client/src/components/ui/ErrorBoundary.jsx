import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import Button from "./Button.jsx";

/**
 * ErrorBoundary — last-resort safety net for render-time exceptions.
 *
 * React 19 still requires a class component for `getDerivedStateFromError`
 * / `componentDidCatch`, so this stays a class. Anything thrown below the
 * boundary is caught, logged once to the console, and replaced with a
 * friendly recovery card. The user can either reload the tab or attempt
 * to remount the failed subtree without losing the rest of the app
 * state (auth, sockets, preferences live above the boundary).
 *
 * In `import.meta.env.DEV` we additionally surface the error message and
 * a short stack snippet so the developer can pinpoint the offender; in
 * production we keep the surface intentionally minimal.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined") {
      console.error("[ErrorBoundary] render failure:", error, info);
    }
  }

  handleReset() {
    this.setState({ error: null });
  }

  handleReload() {
    if (typeof window !== "undefined") window.location.reload();
  }

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;

    if (typeof fallback === "function") {
      return fallback({ error, reset: this.handleReset });
    }
    if (fallback) return fallback;

    const isDev = Boolean(import.meta?.env?.DEV);

    return (
      <div
        role="alert"
        className="flex min-h-[60vh] items-center justify-center px-4 py-10"
      >
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>

          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Bir şeyler ters gitti
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Sayfa beklenmedik bir hatayla karşılaştı. Yeniden denemeyi
            deneyebilir veya sayfayı yenileyebilirsin.
          </p>

          {isDev && (
            <pre className="mt-4 max-h-32 overflow-auto rounded-md bg-zinc-100 p-3 text-left font-mono text-[11px] leading-snug text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
              {error?.message || String(error)}
            </pre>
          )}

          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={this.handleReset}
              leftIcon={RefreshCw}
            >
              Tekrar dene
            </Button>
            <Button variant="primary" size="md" onClick={this.handleReload}>
              Sayfayı yenile
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
