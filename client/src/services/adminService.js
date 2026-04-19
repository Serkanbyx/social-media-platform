import api from "../api/axios.js";

/**
 * Admin service — mirrors every endpoint exposed by `routes/adminRoutes.js`.
 *
 * The corresponding pages (STEP 36) gate themselves behind the admin role,
 * but the server is still the authoritative gate (`adminOnly` middleware):
 * a non-admin token hitting any of these will get a 403 from the API.
 *
 * Pagination contract:
 *   Admin list endpoints are deliberately page-based (`?page=N&limit=K`)
 *   rather than cursor-based — moderators routinely jump around (page 1 →
 *   page 17 → last) so a stable running cursor would be the wrong UX.
 *   Server clamps `limit` into `[1, 100]`; we mirror the default below.
 */

export const ADMIN_PAGE_SIZE = 20;
const MAX_ADMIN_PAGE_SIZE = 100;

const clampPage = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
};

const clampLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return ADMIN_PAGE_SIZE;
  if (parsed > MAX_ADMIN_PAGE_SIZE) return MAX_ADMIN_PAGE_SIZE;
  return parsed;
};

// Strip empty / nullish values so axios doesn't append `?q=` for an empty
// search box — the validator would still pass it but the regex would build
// a no-op `^` anchor and the request URL would be needlessly noisy.
const cleanParams = (params) => {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
};

export const getDashboardStats = async () => {
  const { data } = await api.get("/admin/stats");
  return data;
};

export const listUsers = async ({
  page = 1,
  limit = ADMIN_PAGE_SIZE,
  q,
  role,
  isActive,
} = {}) => {
  const { data } = await api.get("/admin/users", {
    params: cleanParams({
      page: clampPage(page),
      limit: clampLimit(limit),
      q,
      role,
      isActive,
    }),
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
  page = 1,
  limit = ADMIN_PAGE_SIZE,
  q,
  isHidden,
} = {}) => {
  const { data } = await api.get("/admin/posts", {
    params: cleanParams({
      page: clampPage(page),
      limit: clampLimit(limit),
      q,
      isHidden,
    }),
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
  page = 1,
  limit = ADMIN_PAGE_SIZE,
  q,
} = {}) => {
  const { data } = await api.get("/admin/comments", {
    params: cleanParams({
      page: clampPage(page),
      limit: clampLimit(limit),
      q,
    }),
  });
  return data;
};

export const deleteComment = async (id) => {
  const { data } = await api.delete(`/admin/comments/${id}`);
  return data;
};
