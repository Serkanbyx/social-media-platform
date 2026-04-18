import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

/**
 * Banner — page-level inline alert. Distinct from `react-hot-toast`
 * (transient) because banners describe persistent context like
 * "you're offline" or "your account is suspended".
 */
const VARIANTS = {
  info: {
    icon: Info,
    classes:
      "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/60",
  },
  success: {
    icon: CheckCircle2,
    classes:
      "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60",
  },
  warning: {
    icon: AlertTriangle,
    classes:
      "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60",
  },
  danger: {
    icon: AlertTriangle,
    classes:
      "bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/60",
  },
};

export default function Banner({
  variant = "info",
  children,
  onDismiss,
  className = "",
  role,
}) {
  const config = VARIANTS[variant] || VARIANTS.info;
  const Icon = config.icon;
  const computedRole = role || (variant === "danger" || variant === "warning" ? "alert" : "status");

  return (
    <div
      role={computedRole}
      className={`flex items-start gap-3 rounded-md px-4 py-2.5 text-sm ring-1 ${config.classes} ${className}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Kapat"
          className="-mr-1 rounded-md p-1 text-current/70 transition-colors duration-fast hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
