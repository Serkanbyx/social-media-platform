# Social Media Platform

A full-stack social media platform (follow, feed, real-time notifications) built with:

- **Client:** React 19 + Vite + TailwindCSS v4 + React Router v7 + Axios + socket.io-client
- **Server:** Node + Express 5 + Mongoose 9 + Socket.io + JWT + Cloudinary

## Project Structure

```
social-platform/
├── server/   # Node + Express 5 API
├── client/   # React 19 + Vite SPA
├── .gitignore
└── README.md
```

## Getting Started

See `STEPS.md` at the repository root for the full step-by-step build guide.

### Quick start (after dependencies are installed)

```bash
# In one terminal
cd server
npm run dev

# In another terminal
cd client
npm run dev
```

> **Public-repo safety:** never commit any `.env` file. Only the `.env.example` files belong in the repository.

## Accessibility

The app is built and tested against the **WCAG 2.1 AA** baseline. Concretely:

- **Semantic landmarks** — every layout uses `<header>`, `<nav>`, `<main>`, `<aside>` and `<footer>` so assistive tech can jump between regions. A "skip to content" link is the first focusable element on every page.
- **Color contrast** — body text and interactive elements meet a 4.5:1 ratio (3:1 for large text and UI components) in both light and dark themes.
- **Keyboard navigation** — every action is reachable with the keyboard, focus is always visible (`:focus-visible` outlines), modals trap focus and return it to the trigger on close, and dropdown menus use roving tabindex with arrow-key navigation.
- **Screen-reader hints** — icon-only buttons carry `aria-label`; toggle controls expose `aria-pressed` / `role="switch"`; the notification bell announces unread changes via a polite `aria-live` region; toasts use `role="status"` / `role="alert"`.
- **Forms** — every input is paired with a `<label>`, errors are wired through `aria-invalid` + `aria-describedby`, and `autoComplete` hints help password managers.
- **Reduced motion** — animations are silenced when the OS exposes `prefers-reduced-motion: reduce`, and a manual toggle in **Settings → Appearance** mirrors that for users on systems that don't expose the preference.
- **Tooling** — pages are checked with axe DevTools, Lighthouse Accessibility audits target ≥ 95, and a keyboard-only walk-through is run for every release-worthy change.

If you spot an accessibility regression, please open an issue with steps to reproduce.

## Performance

The client is tuned for the Core Web Vitals targets recommended by Google:

- **Route-level code splitting** — every page is wrapped in `React.lazy()` so the initial bundle stays small and feature surfaces are fetched on demand.
- **Tree-shaken named imports** — `lucide-react` and `date-fns` are always imported by name; we never reach for `import * as ...` so unused icons / locales are dropped at build time.
- **Image delivery** — uploads go through Cloudinary with `f_auto,q_auto`, the first feed image is loaded eagerly with `fetchpriority="high"` to anchor LCP, and a low-quality blur placeholder hides any decoding flash.
- **CLS guarded** — every async surface (avatars, feed cards, image grids) reserves its layout via skeletons that mirror the final dimensions and `aspect-ratio` containers on media.
- **Optimistic mutations** — likes, follows and similar interactions update local state synchronously so INP stays well under 200 ms even on slow networks.
- **Self-hosted variable Inter** loads with `font-display: swap` so text is never invisible during the font fetch.

Production targets: Lighthouse Performance ≥ 90 (mobile), Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
