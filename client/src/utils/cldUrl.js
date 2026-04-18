/**
 * cldUrl — Cloudinary URL transformer.
 *
 * Usage:
 *   cldUrl(post.image, { w: 800, q: "auto", f: "auto" })
 *   cldUrl(avatar, { w: 80, h: 80, c: "fill", g: "face" })
 *
 * Non-Cloudinary URLs are returned as-is so the helper is safe to use
 * with mixed image sources (default avatar SVGs, future S3 migration).
 *
 * The blur-up placeholder in PostCard relies on `q: "auto:low", w: 60`.
 */
const CLD_HOST = "res.cloudinary.com";

const TRANSFORM_KEYS = [
  "w", // width
  "h", // height
  "c", // crop mode (fill, fit, scale, thumb…)
  "g", // gravity (face, auto…)
  "q", // quality (auto, auto:low, 80)
  "f", // format (auto, webp, avif)
  "dpr", // device pixel ratio
  "ar", // aspect ratio (e.g. "4:5")
  "r", // radius
  "e", // effect
];

const buildTransform = (options = {}) => {
  const segments = [];
  for (const key of TRANSFORM_KEYS) {
    const value = options[key];
    if (value === undefined || value === null || value === "") continue;
    segments.push(`${key}_${value}`);
  }
  return segments.join(",");
};

export function cldUrl(url, options = {}) {
  if (!url || typeof url !== "string") return url || "";
  if (!url.includes(CLD_HOST)) return url;

  const transform = buildTransform(options);
  if (!transform) return url;

  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  const before = url.slice(0, idx + marker.length);
  let after = url.slice(idx + marker.length);

  // Strip an existing transform segment to avoid double-transforming.
  if (/^[a-z]_[^/]+(?:,[a-z]_[^/]+)*\//i.test(after)) {
    after = after.replace(/^[a-z]_[^/]+(?:,[a-z]_[^/]+)*\//i, "");
  }

  return `${before}${transform}/${after}`;
}

export default cldUrl;
