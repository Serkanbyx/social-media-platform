import { Link } from "react-router-dom";
import Button from "./Button.jsx";
import { cn } from "../../utils/cn.js";

/**
 * EmptyState — friendly placeholder used whenever a list is intentionally
 * empty (no posts in feed, no notifications, no search results).
 *
 * Distinct from `Spinner` (still loading) and `Banner` (transient
 * status). Always offers a primary action so the user has somewhere to
 * go from the empty page.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}) {
  const renderAction = () => {
    if (!action) return null;
    if (action.href) {
      return (
        <Button as={Link} to={action.href} variant="primary" size="md">
          {action.label}
        </Button>
      );
    }
    return (
      <Button onClick={action.onClick} variant="primary" size="md">
        {action.label}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      )}
      {title && (
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>
      )}
      {description && (
        <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{renderAction()}</div>}
    </div>
  );
}
