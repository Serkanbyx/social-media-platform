import Skeleton from "../Skeleton.jsx";

export default function NotificationItemSkeleton() {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Skeleton circle width={36} height={36} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton height={12} width="72%" />
        <Skeleton height={10} width="32%" />
      </div>
    </li>
  );
}
