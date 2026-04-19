import asyncHandler from "../utils/asyncHandler.js";
import { uploadBuffer, destroyByPublicId } from "../config/cloudinary.js";

// Cloudinary folder is namespaced per asset class so avatar cleanup never
// risks touching post images, and we can apply per-folder transformation
// presets later (e.g. face-cropped thumbnails) without code changes here.
const AVATAR_FOLDER = "social/avatars";

// POST /api/uploads/avatar
// Streams the in-memory file buffer to Cloudinary, swaps the user's avatar
// pointer, and best-effort deletes the previous asset so we don't accumulate
// orphaned files in the bucket on every replace.
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({
      status: "error",
      message: "An image file is required (field name: \"avatar\").",
    });
  }

  const previousPublicId = req.user.avatar?.publicId || "";

  const result = await uploadBuffer(req.file.buffer, AVATAR_FOLDER);

  req.user.avatar = {
    url: result.secure_url,
    publicId: result.public_id,
  };

  await req.user.save();

  // Fire-and-await the old-asset cleanup AFTER the new avatar is persisted
  // so a Cloudinary delete failure can never leave the user with no avatar
  // pointer at all. `destroyByPublicId` already swallows non-fatal errors.
  if (previousPublicId && previousPublicId !== result.public_id) {
    await destroyByPublicId(previousPublicId);
  }

  return res.status(200).json({
    status: "success",
    avatar: req.user.avatar,
  });
});

// DELETE /api/uploads/avatar
// Clears the user's avatar pointer and best-effort deletes the underlying
// Cloudinary asset. Idempotent: returns 200 with an empty avatar payload
// even when the user had no avatar to begin with so the client can call
// this without a pre-check.
export const deleteAvatar = asyncHandler(async (req, res) => {
  const previousPublicId = req.user.avatar?.publicId || "";

  if (req.user.avatar?.url || previousPublicId) {
    req.user.avatar = { url: "", publicId: "" };
    await req.user.save();
  }

  if (previousPublicId) {
    await destroyByPublicId(previousPublicId);
  }

  return res.status(200).json({
    status: "success",
    avatar: { url: "", publicId: "" },
  });
});

export default { uploadAvatar, deleteAvatar };
