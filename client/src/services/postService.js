import api from "../api/axios.js";

import {
  DEFAULT_PAGE_LIMIT,
  EXPLORE_PAGE_LIMIT,
  clampLimit,
} from "../utils/constants.js";

/**
 * Post service — thin wrapper around `/api/posts/*`.
 *
 * `createPost` accepts a `FormData` instance because the server route uses
 * multer to parse `multipart/form-data` (text content + optional image
 * file). Axios sets the correct `Content-Type` (with boundary) automatically
 * when the body is a `FormData` — never set it manually.
 */

export const createPost = async (formData) => {
  const { data } = await api.post("/posts", formData);
  return data;
};

export const updatePost = async (id, payload) => {
  const { data } = await api.patch(`/posts/${id}`, payload);
  return data;
};

export const deletePost = async (id) => {
  const { data } = await api.delete(`/posts/${id}`);
  return data;
};

export const getPostById = async (id) => {
  const { data } = await api.get(`/posts/${id}`);
  return data;
};

export const getPostsByUsername = async (
  username,
  cursor,
  limit = DEFAULT_PAGE_LIMIT
) => {
  const { data } = await api.get(
    `/posts/user/${encodeURIComponent(username)}`,
    { params: { cursor, limit: clampLimit(limit, DEFAULT_PAGE_LIMIT) } }
  );
  return data;
};

export const explorePosts = async ({
  cursor,
  limit = EXPLORE_PAGE_LIMIT,
  q,
} = {}) => {
  const { data } = await api.get("/posts/explore", {
    params: { cursor, limit: clampLimit(limit, EXPLORE_PAGE_LIMIT), q },
  });
  return data;
};

export const toggleLike = async (postId) => {
  const { data } = await api.post(`/posts/${postId}/like`);
  return data;
};
