import { cn } from "../../utils/cn.js";

/**
 * Skeleton — generic shimmering placeholder. Component-specific
 * skeletons (PostCardSkeleton etc.) compose this primitive to mirror
 * their real layouts and prevent CLS during loading.
 *
 * `circle` swaps the rounding for a perfect circle (avatar fallback);
 * otherwise uses the design-system rounded-md.
 */
export default function Skeleton({
  className = "",
  width,
  height,
  circle = false,
  rounded,
  ...rest
}) {
  const style = {};
  if (width !== undefined)
    style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined)
    style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "skeleton block",
        circle ? "rounded-full" : rounded ? rounded : "",
        className
      )}
      style={style}
      {...rest}
    />
  );
}
