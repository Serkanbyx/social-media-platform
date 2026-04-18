import { useMemo } from "react";

/**
 * Avatar — circular user image with a deterministic colored initial as
 * fallback. The initial is derived from `name` (preferred) or `username`
 * so the same user always renders the same avatar across the app.
 *
 * Sizes follow the design system scale.
 */
const SIZE_MAP = {
  xs: "size-6 text-2xs",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-24 text-2xl",
};

const PALETTE = [
  "bg-brand-600 text-white",
  "bg-rose-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-sky-500 text-white",
  "bg-fuchsia-500 text-white",
];

const initialOf = (value) => {
  if (!value) return "?";
  const trimmed = String(value).trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
};

const colorFor = (key) => {
  const seed = String(key || "");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
};

export default function Avatar({
  src,
  name,
  username,
  size = "md",
  className = "",
  alt,
}) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const initials = useMemo(() => initialOf(name || username), [name, username]);
  const color = useMemo(() => colorFor(username || name), [username, name]);
  const altText = alt || name || (username ? `@${username}` : "Kullanıcı avatarı");

  if (src) {
    return (
      <img
        src={src}
        alt={altText}
        loading="lazy"
        decoding="async"
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800 ${className}`}
      />
    );
  }

  return (
    <span
      aria-label={altText}
      role="img"
      className={`${sizeClass} ${color} inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-1 ring-black/5 dark:ring-white/10 ${className}`}
    >
      {initials}
    </span>
  );
}
