import toast from "react-hot-toast";

/**
 * Friendly fallback shown when no specific server message is available.
 * Kept Turkish to match the app-wide locale.
 */
const DEFAULT_ERROR_MESSAGE = "Bir şeyler ters gitti. Lütfen tekrar dene.";

/**
 * Extract a human-readable message from anything we might pass to
 * `notify.error`. Accepts:
 *  - plain strings (returned verbatim)
 *  - `AxiosError` instances (uses `response.data.message`, then
 *    `response.data.error`, then the network error message)
 *  - generic `Error` instances
 *  - validate-middleware payloads (`{ errors: [{ message }] }`)
 *
 * Falls back to a friendly Turkish copy so the UI never surfaces raw
 * stack traces or "[object Object]".
 */
const resolveErrorMessage = (input) => {
  if (!input) return DEFAULT_ERROR_MESSAGE;
  if (typeof input === "string") return input;

  const responseData = input?.response?.data;

  if (responseData) {
    if (typeof responseData === "string") return responseData;
    if (typeof responseData.message === "string") return responseData.message;
    if (typeof responseData.error === "string") return responseData.error;
    if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
      const first = responseData.errors[0];
      if (typeof first === "string") return first;
      if (typeof first?.message === "string") return first.message;
    }
  }

  if (typeof input.message === "string" && input.message) {
    return input.message;
  }

  return DEFAULT_ERROR_MESSAGE;
};

/**
 * notify — thin wrapper around `react-hot-toast` that centralises the
 * visual contract (durations, icons, ARIA roles via the underlying
 * library). Prefer this over importing `toast` directly so toast styles
 * stay consistent across the app.
 *
 * `notify.error` is forgiving: pass it a string, an `AxiosError`, or any
 * thrown value and it will surface the most useful message it can find.
 */
export const notify = {
  success: (message, options) =>
    toast.success(message, { duration: 2800, ...options }),
  error: (input, options) =>
    toast.error(resolveErrorMessage(input), { duration: 4200, ...options }),
  info: (message, options) =>
    toast(message, { duration: 3200, icon: "ℹ️", ...options }),
  loading: (message, options) =>
    toast.loading(message, { ...options }),
  dismiss: (id) => toast.dismiss(id),
  promise: (promise, messages, options) =>
    toast.promise(promise, messages, options),
};

export { resolveErrorMessage };
export default notify;
