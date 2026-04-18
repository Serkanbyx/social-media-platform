import api from "../api/axios.js";

import { FEED_PAGE_LIMIT, clampLimit } from "../utils/constants.js";

/**
 * Feed service — `/api/feed` is the personalized timeline of accounts the
 * viewer follows. Authenticated-only (axios interceptor attaches the JWT).
 */

export const getFeed = async ({ cursor, limit = FEED_PAGE_LIMIT } = {}) => {
  const { data } = await api.get("/feed", {
    params: { cursor, limit: clampLimit(limit, FEED_PAGE_LIMIT) },
  });
  return data;
};
