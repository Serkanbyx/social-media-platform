import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { Heart, ImageIcon, MessageCircle } from "lucide-react";

import { cldUrl } from "../../utils/cldUrl.js";
import { cn } from "../../utils/cn.js";
import compactCount from "../../utils/formatCount.js";
import { hashStringToHue, truncate } from "../../utils/helpers.js";

/**
 * PostGrid — image-first thumbnail gallery used by the profile timeline
 * (STEP 31). Two cell variants based on the post's content:
 *
 *  - With image: square Cloudinary thumbnail (`w_500,h_500,c_fill`),
 *    overlaid with like + comment counts on hover/focus via a soft
 *    bottom-up gradient.
 *  - Text-only: a deterministic gradient card derived from the author's
 *    username so the same user always lands on the same hue. The first
 *    six visible lines of the post body are rendered as a teaser.
 *
 * Each cell is a `<Link>` to `/posts/:id`, sized as a square via the
 * `aspect-square` Tailwind utility so the grid never wobbles while
 * Cloudinary is still loading. A keyboard focus ring matches the
 * design-system contract.
 */

const TEXT_PREVIEW_LIMIT = 240;

function ImageCell({ post, href, altText }) {
  const thumbUrl = cldUrl(post.image?.url, {
    w: 500,
    h: 500,
    c: "fill",
    q: "auto",
    f: "auto",
  });

  const likes = compactCount(post.likesCount ?? 0);
  const comments = compactCount(post.commentsCount ?? 0);

  return (
    <Link
      to={href}
      aria-label={altText}
      className={cn(
        "group/cell relative block overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800",
        "ring-1 ring-zinc-200/70 transition-shadow duration-fast",
        "hover:shadow-md focus-visible:shadow-md dark:ring-zinc-800",
        "aspect-square"
      )}
    >
      <img
        src={thumbUrl}
        alt={altText}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn(
          "absolute inset-0 size-full object-cover transition-transform duration-base",
          "group-hover/cell:scale-[1.03] motion-reduce:group-hover/cell:scale-100"
        )}
      />

      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 flex items-end justify-center",
          "bg-gradient-to-t from-black/70 via-black/30 to-transparent",
          "opacity-0 transition-opacity duration-base",
          "group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100"
        )}
      >
        <div className="flex items-center gap-4 pb-3 text-sm font-semibold text-white tnum">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="size-4 fill-current" aria-hidden="true" />
            {likes}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="size-4 fill-current" aria-hidden="true" />
            {comments}
          </span>
        </div>
      </div>
    </Link>
  );
}

function TextCell({ post, href, altText }) {
  const username = post.author?.username || "user";
  const hue = useMemo(() => hashStringToHue(username), [username]);
  const preview = truncate(post.content || "", TEXT_PREVIEW_LIMIT);

  // Two-stop gradient based on the deterministic author hue. Saturation
  // and lightness are tuned to stay readable in both light and dark
  // mode while the white text overlay sits on top.
  const gradient = {
    backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 56%) 0%, hsl(${
      (hue + 32) % 360
    } 65% 42%) 100%)`,
  };

  return (
    <Link
      to={href}
      aria-label={altText}
      style={gradient}
      className={cn(
        "group/cell relative block overflow-hidden rounded-xl text-white",
        "ring-1 ring-black/5 transition-shadow duration-fast hover:shadow-md focus-visible:shadow-md",
        "aspect-square"
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-tr from-black/25 via-transparent to-white/10"
      />
      <div className="relative flex h-full flex-col justify-between p-4">
        <p className="line-clamp-6 text-sm leading-relaxed font-medium whitespace-pre-wrap break-words">
          {preview}
        </p>
        <div className="flex items-center justify-between text-xs font-semibold opacity-90 tnum">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="size-3.5 fill-current" aria-hidden="true" />
            {compactCount(post.likesCount ?? 0)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="size-3.5 fill-current" aria-hidden="true" />
            {compactCount(post.commentsCount ?? 0)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function PostGridCell({ post }) {
  const href = `/posts/${post._id}`;
  const username = post.author?.username || "user";
  const altText = post.content
    ? truncate(post.content, 80)
    : `@${username} kullanıcısının gönderisi`;

  if (post.image?.url) {
    return <ImageCell post={post} href={href} altText={altText} />;
  }

  return <TextCell post={post} href={href} altText={altText} />;
}

function PostGridSkeleton({ count = 6 }) {
  return (
    <ul
      aria-busy="true"
      aria-live="polite"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }, (_, idx) => (
        <li key={`grid-skel-${idx}`}>
          <span
            aria-hidden="true"
            className="skeleton block aspect-square w-full rounded-xl"
          />
        </li>
      ))}
    </ul>
  );
}

function PostGrid({ posts = [], className = "" }) {
  if (!Array.isArray(posts) || posts.length === 0) return null;

  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {posts.map((post) => (
        <li key={post._id} className="motion-safe:animate-fade-up">
          <PostGridCell post={post} />
        </li>
      ))}
    </ul>
  );
}

const MemoizedPostGrid = memo(PostGrid);
MemoizedPostGrid.Skeleton = PostGridSkeleton;
MemoizedPostGrid.EmptyIcon = ImageIcon;

export default MemoizedPostGrid;
