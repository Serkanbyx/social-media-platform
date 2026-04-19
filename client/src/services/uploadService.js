import api from "../api/axios.js";

/**
 * Upload service — currently exposes the single avatar upload endpoint.
 *
 * As with `createPost`, the body MUST be a `FormData` so axios sets the
 * correct multipart `Content-Type` header (with boundary) automatically.
 * The server enforces the MIME whitelist + size limit + Cloudinary
 * server-generated `public_id` — never trust the file name on the client.
 */

export const uploadAvatar = async (formData, options = {}) => {
  const { data } = await api.post("/uploads/avatar", formData, options);
  return data;
};

export const deleteAvatar = async () => {
  const { data } = await api.delete("/uploads/avatar");
  return data;
};

export const uploadBanner = async (formData, options = {}) => {
  const { data } = await api.post("/uploads/banner", formData, options);
  return data;
};

export const deleteBanner = async () => {
  const { data } = await api.delete("/uploads/banner");
  return data;
};
