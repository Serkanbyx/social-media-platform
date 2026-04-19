import { Outlet } from "react-router-dom";

import { useOnlineStatus } from "../../hooks/useOnlineStatus.js";
import Banner from "../ui/Banner.jsx";
import Footer from "./Footer.jsx";
import Navbar from "./Navbar.jsx";
import ScrollToTop from "./ScrollToTop.jsx";

/**
 * MainLayout — default chrome for the consumer-facing app:
 *   skip link · navbar · offline banner · main content · footer.
 *
 * The bottom padding on mobile (`pb-20`) clears the fixed bottom tab bar
 * inside `Navbar`, while desktop uses the natural footer spacing.
 */
export default function MainLayout() {
  const online = useOnlineStatus();

  return (
    <div className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <ScrollToTop />

      <a
        href="#main"
        className="sr-only-focusable absolute left-2 top-2 z-50 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-md focus:outline-none"
      >
        Skip to content
      </a>

      <Navbar />

      {!online && (
        <div className="mx-auto w-full max-w-2xl px-4 pt-3 sm:px-6">
          <Banner variant="warning">
            You&apos;re offline — some features may not work.
          </Banner>
        </div>
      )}

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-20 sm:px-6 md:pb-6"
      >
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
