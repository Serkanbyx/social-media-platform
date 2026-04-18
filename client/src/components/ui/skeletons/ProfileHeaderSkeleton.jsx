import Skeleton from "../Skeleton.jsx";

/**
 * Profile header is taller than a card so the skeleton reserves more
 * vertical room — matches the real `ProfileHeader` (avatar, name, bio,
 * stats row).
 */
export default function ProfileHeaderSkeleton() {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-4">
        <Skeleton circle width={96} height={96} />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton height={18} width="50%" />
          <Skeleton height={12} width="35%" />
          <div className="space-y-1.5 pt-2">
            <Skeleton height={10} />
            <Skeleton height={10} width="80%" />
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-6">
        <Skeleton height={14} width={64} />
        <Skeleton height={14} width={88} />
        <Skeleton height={14} width={88} />
      </div>
    </section>
  );
}
