import Skeleton from "../Skeleton.jsx";

/**
 * PostCardSkeleton — mirrors PostCard's feed variant dimensions so the
 * page layout doesn't shift when real cards stream in.
 */
export default function PostCardSkeleton() {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-center gap-3">
        <Skeleton circle width={40} height={40} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton height={12} width="40%" />
          <Skeleton height={10} width="25%" />
        </div>
      </header>
      <div className="mt-3 space-y-2">
        <Skeleton height={12} />
        <Skeleton height={12} width="92%" />
        <Skeleton height={12} width="68%" />
      </div>
      <Skeleton className="mt-3 aspect-video w-full" rounded="rounded-xl" />
      <div className="mt-3 flex items-center gap-4">
        <Skeleton height={16} width={56} />
        <Skeleton height={16} width={56} />
        <Skeleton height={16} width={56} />
      </div>
    </article>
  );
}
