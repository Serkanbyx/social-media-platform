import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  Compass,
  Flame,
  ImagePlus,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";

import PostGrid from "../../components/post/PostGrid.jsx";

import useDocumentTitle from "../../hooks/useDocumentTitle.js";
import * as postService from "../../services/postService.js";

/**
 * LandingPage — public homepage for unauthenticated visitors (STEP 39).
 *
 * Strategy: instead of a traditional marketing hero, "drop the visitor
 * straight into the product". A compact hero with the primary CTAs sits
 * above a live grid of trending posts so the first viewport already
 * communicates *what* Pulse is — not just *that* it exists.
 *
 * Composition (top → bottom):
 *  1. Hero band — gradient backdrop, tagline, sign up / log in CTAs,
 *     plus a row of feature pills that summarize the product surface.
 *  2. Trending grid — `PostGrid` fed by `postService.explorePosts`. The
 *     grid is rendered inside a wider container (negative margins on
 *     `MainLayout`'s 2xl rail) so the 3-column layout actually breathes
 *     on desktop without affecting feed/profile pages.
 *  3. Feature highlights — three short value props with icons, kept
 *     subtle to not steal attention from the live content above.
 *  4. Closing CTA card — last-call sign up nudge before the footer.
 *
 * Data:
 *  - Read-only call to the public `/posts/explore` endpoint with the
 *    same defaults `ExplorePage` uses, but capped at 9 items so the
 *    landing renders fast and stays a "preview", not a full feed.
 *  - Failures degrade to a friendly empty state — visitors should still
 *    see CTAs even when the API is down.
 *
 * Routing: rendered by `App.jsx`'s `HomeRoute` only when there is no
 * authenticated user; signed-in visitors keep getting the feed at `/`.
 */

const TRENDING_LIMIT = 9;

const FEATURE_PILLS = [
  { icon: Zap, label: "Anlık akış" },
  { icon: Bell, label: "Gerçek zamanlı bildirimler" },
  { icon: ImagePlus, label: "Görsel paylaşımı" },
  { icon: Compass, label: "Trend keşfi" },
];

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "Saniyeler içinde paylaş",
    body: "Metin ya da görsel — tek bir kompozer, hızlı klavye akışı ve karakter sayacıyla istediğini söyle.",
  },
  {
    icon: Users,
    title: "Topluluğunu kur",
    body: "İlham aldığın insanları takip et, profilinde paylaşımlarının ızgarasını sergile.",
  },
  {
    icon: Bell,
    title: "Gelişmeleri kaçırma",
    body: "Beğeni, yorum ve takip bildirimleri canlı bağlantı üzerinden anında düşer.",
  },
];

export default function LandingPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useDocumentTitle("Pulse — Toplulukla nabzını tut");

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await postService.explorePosts({ limit: TRENDING_LIMIT });
      setPosts(Array.isArray(data?.items) ? data.items.slice(0, TRENDING_LIMIT) : []);
    } catch {
      setPosts([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  const showSkeleton = loading;
  const showEmpty = !loading && (error || posts.length === 0);
  const showGrid = !loading && !error && posts.length > 0;

  const skeleton = useMemo(
    () => <PostGrid.Skeleton count={TRENDING_LIMIT} />,
    []
  );

  return (
    <div className="space-y-12 pb-4 sm:space-y-16">
      {/* ----- Hero ----- */}
      <section
        aria-labelledby="landing-hero-title"
        className="relative -mx-4 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 via-white to-brand-100 px-6 py-10 ring-1 ring-brand-100 sm:-mx-6 sm:px-10 sm:py-14 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 dark:ring-zinc-800"
      >
        {/* Decorative gradient blobs — purely visual, hidden from a11y */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-200/60 blur-3xl dark:bg-brand-500/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-500/5"
        />

        <div className="relative mx-auto max-w-2xl space-y-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 backdrop-blur dark:bg-zinc-900/70 dark:text-brand-300 dark:ring-brand-900">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Topluluk şu an aktif
          </span>

          <h1
            id="landing-hero-title"
            className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50"
          >
            Toplulukla{" "}
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent dark:from-brand-300 dark:to-brand-500">
              nabzını
            </span>{" "}
            tut.
          </h1>

          <p className="text-pretty text-base text-zinc-600 sm:text-lg dark:text-zinc-300">
            Düşüncelerini paylaş, ilham aldığın insanları takip et, anlık
            bildirimlerle gelişmelerden kopma. Pulse, sade ve hızlı bir
            sosyal akış deneyimi sunar.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              as={Link}
              to="/register"
              size="lg"
              variant="primary"
              rightIcon={ArrowRight}
              className="w-full sm:w-auto"
            >
              Ücretsiz hesap aç
            </Button>
            <Button
              as={Link}
              to="/login"
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              Giriş yap
            </Button>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            ya da{" "}
            <Link
              to="/explore"
              className="font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              önce keşfetmeye başla
            </Link>
          </p>

          <ul className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {FEATURE_PILLS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 backdrop-blur dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-800"
              >
                <Icon className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----- Trending preview (escapes the 2xl rail for a roomier grid) ----- */}
      <section
        aria-labelledby="landing-trending-title"
        className="-mx-4 sm:-mx-6"
      >
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h2
                id="landing-trending-title"
                className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50"
              >
                <Flame className="size-5 text-amber-500" aria-hidden="true" />
                Topluluktan öne çıkanlar
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Şu anda Pulse'ta nabız tutan paylaşımlardan bir kesit.
              </p>
            </div>

            <Link
              to="/explore"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Tümünü Keşfet'te gör
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </header>

          {showSkeleton && skeleton}

          {showEmpty && (
            <EmptyState
              icon={Flame}
              title={
                error
                  ? "Trendler şu an yüklenemedi"
                  : "Henüz trend bir şey yok"
              }
              description={
                error
                  ? "Bağlantını kontrol edip tekrar deneyebilirsin."
                  : "İlk paylaşımı yaparak burayı sen başlatabilirsin."
              }
              action={
                error
                  ? { label: "Tekrar dene", onClick: fetchTrending }
                  : { label: "Hesap aç", href: "/register" }
              }
            />
          )}

          {showGrid && <PostGrid posts={posts} />}
        </div>
      </section>

      {/* ----- Highlights ----- */}
      <section
        aria-labelledby="landing-highlights-title"
        className="space-y-6"
      >
        <header className="space-y-1 text-center">
          <h2
            id="landing-highlights-title"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Neden Pulse?
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Üç şeyi iyi yapar: paylaşmak, takip etmek, haberdar kalmak.
          </p>
        </header>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-2xl border border-zinc-200 bg-white p-5 transition-shadow duration-base hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-900/60">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {title}
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ----- Closing CTA ----- */}
      <section aria-labelledby="landing-cta-title">
        <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-600 to-brand-500 p-6 text-white shadow-md sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8 dark:border-brand-900">
          <div className="space-y-1">
            <h2
              id="landing-cta-title"
              className="text-lg font-semibold sm:text-xl"
            >
              Hazırsan başla.
            </h2>
            <p className="text-sm text-white/85">
              Hesabın 30 saniyede hazır — hemen ilk gönderini paylaş.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:flex-row">
            <Button
              as={Link}
              to="/register"
              size="md"
              variant="secondary"
              rightIcon={ArrowRight}
              className="w-full bg-white text-brand-700 hover:bg-zinc-100 sm:w-auto"
            >
              Hesap aç
            </Button>
            <Button
              as={Link}
              to="/login"
              size="md"
              variant="ghost"
              className="w-full text-white hover:bg-white/15 sm:w-auto"
            >
              Giriş yap
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
