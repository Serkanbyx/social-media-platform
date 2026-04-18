import Skeleton from "../Skeleton.jsx";

export default function UserCardSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <Skeleton circle width={40} height={40} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton height={12} width="55%" />
        <Skeleton height={10} width="35%" />
      </div>
      <Skeleton height={32} width={88} rounded="rounded-md" />
    </li>
  );
}
