import toast from "react-hot-toast";

/**
 * notify — thin wrapper around `react-hot-toast` that centralises the
 * visual contract (durations, icons, ARIA roles via the underlying
 * library). Prefer this over importing `toast` directly so toast styles
 * stay consistent across the app.
 */
export const notify = {
  success: (message, options) =>
    toast.success(message, { duration: 2800, ...options }),
  error: (message, options) =>
    toast.error(message, { duration: 4200, ...options }),
  info: (message, options) =>
    toast(message, { duration: 3200, icon: "ℹ️", ...options }),
  loading: (message, options) =>
    toast.loading(message, { ...options }),
  dismiss: (id) => toast.dismiss(id),
  promise: (promise, messages, options) =>
    toast.promise(promise, messages, options),
};

export default notify;
