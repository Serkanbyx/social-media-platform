/**
 * _PlaceholderPage — temporary scaffold used by every page module that
 * STEP 23 wires into the router but later steps will fully implement.
 *
 * Centralizing the placeholder keeps the page files trivial (one import,
 * one props object) and guarantees a consistent visual language for "this
 * surface exists but isn't built yet" until the matching step lands.
 */
export default function PlaceholderPage({ title, description, step }) {
  return (
    <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-2xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
        {step ? `Yapım aşamasında · ${step}` : "Yapım aşamasında"}
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      )}
    </section>
  );
}
