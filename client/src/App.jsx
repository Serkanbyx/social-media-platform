import { useEffect, useState } from "react";
import { Heart, Moon, Sun, Sparkles } from "lucide-react";
import logoUrl from "./assets/logo.svg";

/**
 * Design System Preview (STEP 20)
 * --------------------------------------------------------------
 * Temporary surface that exercises every token defined in
 * `index.css` so the visual language can be verified before any
 * real pages are built (STEPS 21+ replace this with the router).
 */
export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(128);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggleLike = () => {
    setLiked((prev) => {
      setLikeCount((c) => c + (prev ? -1 : 1));
      return !prev;
    });
  };

  return (
    <div className="min-h-full bg-white text-zinc-900 transition-colors duration-base dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <img
            src={logoUrl}
            alt="Pulse"
            className="h-7 w-auto text-brand-600 dark:text-brand-400"
          />
          <button
            type="button"
            onClick={() => setIsDark((v) => !v)}
            aria-label={isDark ? "Aydınlık moda geç" : "Karanlık moda geç"}
            className="inline-flex size-9 items-center justify-center rounded-full text-zinc-600 transition-colors duration-fast hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none motion-safe:active:scale-[0.96] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <section className="space-y-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Design system v1
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Pulse — bir his, bir paylaşım.
          </h1>
          <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            Bu ekran tasarım sisteminin canlı bir önizlemesidir. Renkler, tipografi,
            yarıçaplar, gölgeler ve hareket dili sonraki adımlarda inşa edilecek
            tüm bileşenler için tek doğruluk kaynağıdır.
          </p>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <DemoCard title="Brand scale (50 → 950)">
            <div className="flex overflow-hidden rounded-md ring-1 ring-zinc-200 dark:ring-zinc-800">
              {[
                "bg-brand-50",
                "bg-brand-100",
                "bg-brand-200",
                "bg-brand-300",
                "bg-brand-400",
                "bg-brand-500",
                "bg-brand-600",
                "bg-brand-700",
                "bg-brand-800",
                "bg-brand-900",
                "bg-brand-950",
              ].map((cls) => (
                <div key={cls} className={`${cls} h-10 flex-1`} />
              ))}
            </div>
          </DemoCard>

          <DemoCard title="Type scale">
            <div className="space-y-1">
              <p className="text-2xs text-zinc-500">2xs · 11/14 · meta</p>
              <p className="text-xs text-zinc-500">xs · 12/16 · caption</p>
              <p className="text-sm">sm · 14/20 · secondary</p>
              <p className="text-base">base · 16/24 · body</p>
              <p className="text-lg font-medium">lg · 18/28 · card title</p>
              <p className="text-2xl font-bold">2xl · 24/32 · page title</p>
            </div>
          </DemoCard>

          <DemoCard title="Buttons & states">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors duration-fast hover:bg-brand-700 motion-safe:active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-400"
              >
                Primary
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors duration-fast hover:bg-zinc-50 motion-safe:active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Secondary
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition-colors duration-fast hover:bg-zinc-100 motion-safe:active:scale-[0.98] dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              >
                Ghost
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white opacity-50 dark:bg-brand-500"
              >
                Disabled
              </button>
            </div>
          </DemoCard>

          <DemoCard title="Like — micro-interaction">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleLike}
                aria-pressed={liked}
                aria-label={liked ? "Beğenmekten vazgeç" : "Beğen"}
                className="inline-flex size-10 items-center justify-center rounded-full text-zinc-500 transition-colors duration-fast hover:bg-rose-50 hover:text-rose-500 dark:text-zinc-400 dark:hover:bg-rose-950/40"
              >
                <Heart
                  className={`size-5 transition-colors duration-fast ${
                    liked
                      ? "fill-rose-500 text-rose-500 motion-safe:animate-like-pop dark:fill-rose-400 dark:text-rose-400"
                      : ""
                  }`}
                />
              </button>
              <span className="tnum text-sm text-zinc-600 dark:text-zinc-400">
                {likeCount.toLocaleString("tr-TR")} beğeni
              </span>
            </div>
          </DemoCard>

          <DemoCard title="Surfaces & shadows">
            <div className="grid grid-cols-3 gap-3">
              <Surface label="xs" shadow="shadow-xs" />
              <Surface label="sm" shadow="shadow-sm" />
              <Surface label="md" shadow="shadow-md" />
            </div>
          </DemoCard>

          <DemoCard title="Skeleton (shimmer)">
            <div className="space-y-2">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          </DemoCard>
        </section>

        <p className="mt-10 text-xs text-zinc-500">
          Bu önizleme STEP 21 ile birlikte router ve gerçek sayfalarla değiştirilecektir.
        </p>
      </main>
    </div>
  );
}

function DemoCard({ title, children }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </article>
  );
}

function Surface({ label, shadow }) {
  return (
    <div
      className={`flex h-16 items-center justify-center rounded-md bg-white text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/5 ${shadow}`}
    >
      {label}
    </div>
  );
}
