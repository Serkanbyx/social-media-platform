import { useEffect, useRef } from "react";

/**
 * useInfiniteScroll — observes a sentinel element and triggers `onLoadMore`
 * whenever it crosses into view, as long as more data is available and we
 * are not already loading.
 *
 * Pattern of choice for the feed/explore/comments lists: keeps scroll
 * smooth, plays nicely with React 19 strict mode (cleanup disconnects the
 * observer) and uses a generous `rootMargin` so users rarely see a hard
 * pause at the bottom of the page.
 */
export function useInfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
  rootMargin = "300px",
} = {}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || typeof onLoadMore !== "function") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, rootMargin]);

  return sentinelRef;
}

export default useInfiniteScroll;
