// Cloudinary SDK initialisation + small upload/destroy helpers.
//
// We never accept disk paths from the client — uploads are streamed straight
// from the in-memory multer buffer to Cloudinary, so there are no temp files
// on disk and no user-controlled filenames hit the FS.

import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

import env from "./env.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Stream an in-memory buffer to Cloudinary. `folder` namespaces uploads
// (e.g. "social/avatars") so we can apply different transformations / cleanup
// rules per asset class without leaking publicIds across features.
export const uploadBuffer = (buffer, folder) =>
  new Promise((resolve, reject) => {
    if (!Buffer.isBuffer(buffer)) {
      reject(new Error("uploadBuffer: expected a Buffer."));
      return;
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        // Server-generated publicId only — never trust user filenames.
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });

// Best-effort delete. We swallow "not found" so cascade flows
// (post deletion, avatar replacement) don't fail when an asset was already
// removed manually from the Cloudinary dashboard.
export const destroyByPublicId = async (publicId) => {
  if (!publicId) return { result: "skipped" };
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    if (!env.isProduction) {
      console.error(`[cloudinary] destroy failed for ${publicId}:`, error?.message || error);
    }
    return { result: "error" };
  }
};

export { cloudinary };
export default cloudinary;
