import { useEffect } from "react";
import toast, { Toaster, useToasterStore } from "react-hot-toast";

import { useMediaQuery } from "../../hooks/useMediaQuery.js";

/**
 * Maximum number of toasts visible at once. Anything older than this
 * gets dismissed automatically so the stack stays scannable on small
 * screens. Matches the contract documented in STEP 37.
 */
const MAX_VISIBLE = 3;

/**
 * AppToaster — single mounted instance of `react-hot-toast` with the
 * project's visual contract baked in:
 *
 *  - Position is responsive: bottom-right on tablet+, top-center on
 *    phones (the bottom of the viewport hides behind the iOS home
 *    indicator and the mobile bottom tab bar).
 *  - Stack capped at three; older toasts are dismissed on overflow.
 *  - Success uses the brand colour, errors stay rose so destructive
 *    feedback never blends in with a confirmation.
 *  - Default container className aligns with the rest of the design
 *    system (rounded-xl, soft shadow, sm text).
 *
 * Mounted once at the root in `main.jsx`.
 */
export default function AppToaster() {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const { toasts } = useToasterStore();

  useEffect(() => {
    const visible = toasts.filter((t) => t.visible);
    if (visible.length <= MAX_VISIBLE) return;
    visible
      .slice(0, visible.length - MAX_VISIBLE)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  return (
    <Toaster
      position={isMobile ? "top-center" : "bottom-right"}
      gutter={8}
      containerClassName="!z-[100]"
      toastOptions={{
        duration: 3500,
        className:
          "!rounded-xl !shadow-md !text-sm !px-4 !py-3 " +
          "!bg-white !text-zinc-900 dark:!bg-zinc-900 dark:!text-zinc-100 " +
          "!border !border-zinc-200/80 dark:!border-zinc-800/80",
        success: {
          iconTheme: {
            primary: "var(--color-brand-600, #4f46e5)",
            secondary: "white",
          },
        },
        error: {
          duration: 5000,
          iconTheme: {
            primary: "var(--color-rose-600, #e11d48)",
            secondary: "white",
          },
        },
      }}
    />
  );
}
