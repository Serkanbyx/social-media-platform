import api from "../api/axios.js";

import {
  DEFAULT_PAGE_LIMIT,
  clampLimit,
} from "../utils/constants.js";

/**
 * Admin service — mirrors every endpoint exposed by `routes/adminRoutes.js`.
 *
 * The corresponding pages (STEP 36) gate themselves behind the admin role,
 * but the server is still the authoritative gate (`adminOnly` middleware):
 * a non-admin token hitting any of these will get a 403 from the API.
 */

export const getDashboardStats = async () => {
  const { data } = await api.get("/admin/stats");
  return data;
};

export const listUsers = async ({
  cursor,
  limit = DEFAULT_PAGE_LIMIT,
  q,
  role,
  isActive,
} = {}) => {
  const { data } = await api.get("/admin/users", {
    params: {
      cursor,
      limit: clampLimit(limit, DEFAULT_PAGE_LIMIT),
      q,
      role,
      isActive,
    },
  });
  return data;
};

export const updateUserRole = async (id, role) => {
  const { data } = await api.patch(`/admin/users/${id}/role`, { role });
  return data;
};

export const setUserActive = async (id, isActive) => {
  const { data } = await api.patch(`/admin/users/${id}/active`, { isActive });
  return data;
};

export const deleteUser = async (id) => {
  const { data } = await api.delete(`/admin/users/${id}`);
  return data;
};

export const listAllPosts = async ({
  cursor,
  limit = DEFAULT_PAGE_LIMIT,
  q,
  isHidden,
} = {}) => {
  const { data } = await api.get("/admin/posts", {
    params: {
      cursor,
      limit: clampLimit(limit, DEFAULT_PAGE_LIMIT),
      q,
      isHidden,
    },
  });
  return data;
};

export const hidePost = async (id) => {
  const { data } = await api.patch(`/admin/posts/${id}/hide`);
  return data;
};

export const deletePost = async (id) => {
  const { data } = await api.delete(`/admin/posts/${id}`);
  return data;
};

export const listAllComments = async ({
  cursor,
  limit = DEFAULT_PAGE_LIMIT,
  q,
} = {}) => {
  const { data } = await api.get("/admin/comments", {
    params: { cursor, limit: clampLimit(limit, DEFAULT_PAGE_LIMIT), q },
  });
  return data;
};

export const deleteComment = async (id) => {
  const { data } = await api.delete(`/admin/comments/${id}`);
  return data;
};
