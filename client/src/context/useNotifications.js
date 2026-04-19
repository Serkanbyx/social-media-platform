import { createContext, useContext } from "react";

/**
 * Notification context object, the `useNotifications` hook and the
 * pure helpers consumed by notification rows live here (separate from
 * the `<NotificationProvider>` component file) so React's Fast Refresh
 * keeps working — the rule requires component files to *only* export
 * components.
 */
export const NotificationContext = createContext(null);

const TYPE_SENTENCE = {
  like: "gönderini beğendi",
  comment: "gönderine yorum yaptı",
  follow: "seni takip etmeye başladı",
};

export const sentenceFor = (type) =>
  TYPE_SENTENCE[type] || "yeni bir bildirim gönderdi";

// Build the in-app deep link for a notification. Falls back to the
// notifications page when the embedded post/sender is missing.
export const linkForNotification = (notification) => {
  if (!notification) return "/notifications";
  if (notification.type === "follow" && notification.sender?.username) {
    return `/u/${notification.sender.username}`;
  }
  if (notification.post?._id) return `/posts/${notification.post._id}`;
  return "/notifications";
};

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider."
    );
  }
  return ctx;
}
