import { cn } from "../../utils/cn.js";

/**
 * Logo — inline SVG so the glyph background and the "Pulse" wordmark can
 * react to theme changes independently. Loading the SVG as an `<img>`
 * doesn't let us style its internals, which is why we render it inline.
 *
 * Coloring strategy:
 *  - The glyph rounded square uses `currentColor` from a wrapper group
 *    pinned to the brand color (purple in both themes).
 *  - The white pulse stroke is hardcoded white since it sits inside the
 *    brand square in every theme.
 *  - The wordmark uses `currentColor` from a separate group: brand color
 *    in light mode, white in dark mode for proper contrast on the dark
 *    navbar background.
 */
export default function Logo({ wordmark = true, className = "" }) {
  const viewBox = wordmark ? "0 0 140 32" : "0 0 32 32";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="none"
      role="img"
      aria-label="Pulse"
      className={cn("block", className)}
    >
      <g className="text-brand-600 dark:text-brand-400">
        <rect width="32" height="32" rx="8" fill="currentColor" />
      </g>
      <path
        d="M6 17h4l2.5-6 4 12 3-9 2 3h4.5"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {wordmark && (
        <g className="text-brand-600 dark:text-white">
          <text
            x="42"
            y="22"
            fill="currentColor"
            fontFamily="'Inter Variable', Inter, system-ui, sans-serif"
            fontWeight="700"
            fontSize="18"
            letterSpacing="-0.02em"
          >
            Pulse
          </text>
        </g>
      )}
    </svg>
  );
}
