import api from "../api/axios.js";

import {
  FOLLOW_LIST_PAGE_LIMIT,
  clampLimit,
} from "../utils/constants.js";

/**
 * User service — thin wrapper around `/api/users/*`.
 *
 * Cursor-based pagination matches the server contract: callers pass the
 * `nextCursor` returned by the previous page (or `null`/`undefined` to
 * start). Limits are clamped client-side so a buggy caller can't ask for
 * 10 000 rows and get a 400 from the API.
 */

export const getUserByUsername = async (username) => {
  const { data } = await api.get(`/users/${encodeURIComponent(username)}`);
  return data;
};

export const getFollowers = async (
  username,
  cursor,
  limit = FOLLOW_LIST_PAGE_LIMIT
) => {
  const { data } = await api.get(
    `/users/${encodeURIComponent(username)}/followers`,
    { params: { cursor, limit: clampLimit(limit, FOLLOW_LIST_PAGE_LIMIT) } }
  );
  return data;
};

export const getFollowing = async (
  username,
  cursor,
  limit = FOLLOW_LIST_PAGE_LIMIT
) => {
  const { data } = await api.get(
    `/users/${encodeURIComponent(username)}/following`,
    { params: { cursor, limit: clampLimit(limit, FOLLOW_LIST_PAGE_LIMIT) } }
  );
  return data;
};

export const searchUsers = async (q) => {
  const { data } = await api.get("/users/search", { params: { q } });
  return data;
};

export const getSuggestedUsers = async (limit) => {
  const { data } = await api.get("/users/suggestions", {
    params: limit ? { limit } : undefined,
  });
  return data;
};

export const updateProfile = async (payload) => {
  const { data } = await api.patch("/users/me", payload);
  return data;
};

export const toggleFollow = async (userId) => {
  const { data } = await api.post(`/users/${userId}/follow`);
  return data;
};
