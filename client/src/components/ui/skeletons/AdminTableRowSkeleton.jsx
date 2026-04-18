import Skeleton from "../Skeleton.jsx";

/**
 * AdminTableRowSkeleton — single row matching the column rhythm used by
 * Users/Posts/Comments tables in the admin panel. `columns` lets each
 * table choose how many cells to draw.
 */
export default function AdminTableRowSkeleton({ columns = 4 }) {
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      {Array.from({ length: columns }).map((_, idx) => (
        <td key={idx} className="px-4 py-3">
          <Skeleton height={12} width={idx === 0 ? "70%" : "55%"} />
        </td>
      ))}
    </tr>
  );
}
