import api from "../api/axios.js";

import {
  COMMENTS_PAGE_LIMIT,
  clampLimit,
} from "../utils/constants.js";

/**
 * Comment service — thin wrapper around the comment endpoints.
 *
 * Note the asymmetry on the server (mirrored here):
 *   - Create / list live UNDER the parent post (`/api/posts/:postId/comments`)
 *   - Delete is standalone (`/api/comments/:id`)
 * because deletion has no parent path requirement.
 */

export const createComment = async (postId, content) => {
  const { data } = await api.post(`/posts/${postId}/comments`, { content });
  return data;
};

export const getCommentsByPost = async (
  postId,
  cursor,
  limit = COMMENTS_PAGE_LIMIT
) => {
  const { data } = await api.get(`/posts/${postId}/comments`, {
    params: { cursor, limit: clampLimit(limit, COMMENTS_PAGE_LIMIT) },
  });
  return data;
};

export const deleteComment = async (id) => {
  const { data } = await api.delete(`/comments/${id}`);
  return data;
};
