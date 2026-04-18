import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop — restore the viewport scroll to the top whenever the
 * route changes. Without this, navigating from a long feed to a profile
 * keeps the previous scroll offset, which feels broken on social apps
 * where pages share the same scroll container.
 *
 * Skips when the URL contains a hash (anchor link), so in-page anchors
 * still behave naturally.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);

  return null;
}
