import Skeleton from "../Skeleton.jsx";

export default function CommentItemSkeleton() {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Skeleton circle width={32} height={32} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton height={10} width={96} />
          <Skeleton height={10} width={32} />
        </div>
        <Skeleton height={12} />
        <Skeleton height={12} width="70%" />
      </div>
    </li>
  );
}
