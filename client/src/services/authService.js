import api from "../api/axios.js";

/**
 * Auth service — thin wrapper around `/api/auth/*`.
 *
 * Each function returns `response.data` so callers (contexts, pages, hooks)
 * never need to touch Axios response envelopes. Errors propagate as Axios
 * errors so the caller can read `err.response?.data?.message` for the
 * server-shaped message.
 */

export const register = async (payload) => {
  const { data } = await api.post("/auth/register", payload);
  return data;
};

export const login = async (payload) => {
  const { data } = await api.post("/auth/login", payload);
  return data;
};

export const getMe = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

export const changePassword = async (payload) => {
  const { data } = await api.patch("/auth/change-password", payload);
  return data;
};

export const deleteAccount = async (payload) => {
  const { data } = await api.delete("/auth/delete-account", { data: payload });
  return data;
};
