import api from "../api/axios.js";

import {
  NOTIFICATIONS_PAGE_LIMIT,
  clampLimit,
} from "../utils/constants.js";

/**
 * Notification service — `/api/notifications/*`.
 *
 * The unread-count endpoint is intentionally split from `listNotifications`
 * so the navbar bell can poll a tiny payload without paying for the full
 * list query.
 */

export const listNotifications = async ({
  cursor,
  limit = NOTIFICATIONS_PAGE_LIMIT,
} = {}) => {
  const { data } = await api.get("/notifications", {
    params: { cursor, limit: clampLimit(limit, NOTIFICATIONS_PAGE_LIMIT) },
  });
  return data;
};

export const getUnreadCount = async () => {
  const { data } = await api.get("/notifications/unread-count");
  return data;
};

export const markRead = async (id) => {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
};

export const markAllRead = async () => {
  const { data } = await api.patch("/notifications/read-all");
  return data;
};

export const deleteNotification = async (id) => {
  const { data } = await api.delete(`/notifications/${id}`);
  return data;
};
