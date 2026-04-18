// Multer upload middleware — memory storage only, strict MIME + extension
// allowlist, hard 5 MB cap. Files are forwarded to Cloudinary as buffers in
// the controller layer, so nothing ever touches disk on the API server.

import path from "node:path";
import multer from "multer";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Keep MIME and extension lists in sync. Cloudinary will additionally validate
// the actual image format from magic bytes and return it as `result.format`,
// giving us defence-in-depth against spoofed Content-Type headers.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

// Tag errors with a 4xx statusCode so the global errorHandler responds with
// the right code instead of a generic 500.
const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const fileFilter = (_req, file, cb) => {
  const mime = (file.mimetype || "").toLowerCase();
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(mime) || !ALLOWED_EXTENSIONS.has(extension)) {
    cb(httpError(400, "Invalid file type. Allowed: JPEG, PNG, WebP, GIF."));
    return;
  }

  cb(null, true);
};

const baseMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
});

// Wraps a single-file multer middleware so MulterError instances become
// readable 400 / 413 responses instead of bubbling up as opaque 500s.
const wrapSingle = (fieldName) => {
  const middleware = baseMulter.single(fieldName);

  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (!error) return next();

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return next(httpError(413, "File too large. Maximum size is 5 MB."));
        }
        if (error.code === "LIMIT_UNEXPECTED_FILE") {
          return next(httpError(400, `Unexpected upload field. Expected "${fieldName}".`));
        }
        if (error.code === "LIMIT_FILE_COUNT") {
          return next(httpError(400, "Only one file can be uploaded at a time."));
        }
        return next(httpError(400, error.message || "Upload failed."));
      }

      return next(error);
    });
  };
};

export const uploadAvatar = wrapSingle("avatar");
export const uploadPostImage = wrapSingle("image");

export default { uploadAvatar, uploadPostImage };
