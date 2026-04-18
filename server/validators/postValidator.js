import { body, query } from "express-validator";
import mongoose from "mongoose";

// Mirror the Post model schema so the validator and the DB layer stay in sync.
// Keeping the limit in one source of truth would be ideal — for now, both
// places use the same constant (1000) and any future change must update both.
const MAX_CONTENT_LENGTH = 1000;

// Pagination clamps. Mirrors the controller defaults so an out-of-range
// `limit` is rejected up-front (400) rather than silently coerced.
const MAX_PAGE_SIZE = 30;
const MAX_SEARCH_LENGTH = 80;

// Validation rules for `POST /api/posts`.
//
// `content` is OPTIONAL on its own (image-only posts are allowed) but the
// custom rule below enforces the model-level invariant that a post must have
// either textual content or an uploaded image. We rely on the multer middleware
// having already populated `req.file` before this validator runs (see the route
// middleware order in `routes/postRoutes.js`).
export const createPostRules = [
  body("content")
    // Coerce non-strings (undefined, null, accidental arrays from form-data)
    // to an empty string so the rest of the chain can assume a String input.
    .customSanitizer((value) => (typeof value === "string" ? value : ""))
    .trim()
    .isLength({ max: MAX_CONTENT_LENGTH })
    .withMessage(`Post content must be at most ${MAX_CONTENT_LENGTH} characters.`)
    .bail()
    .custom((value, { req }) => {
      const hasContent = typeof value === "string" && value.trim().length > 0;
      const hasImage = Boolean(req.file?.buffer);

      if (!hasContent && !hasImage) {
        throw new Error("Post must have content or an image.");
      }
      return true;
    }),
];

// Validation rules for `GET /api/posts/explore`.
//
// All three params are optional — an unauthenticated visitor can hit
// `/api/posts/explore` with no query string and get the trending feed.
// We validate up-front so an invalid `cursor` or out-of-range `limit`
// fails fast with a 400 instead of triggering a confusing Mongo cast error.
export const exploreRules = [
  query("q")
    .optional()
    .isString()
    .withMessage("Search query must be a string.")
    .bail()
    .trim()
    .isLength({ max: MAX_SEARCH_LENGTH })
    .withMessage(`Search query must be at most ${MAX_SEARCH_LENGTH} characters.`),
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_PAGE_SIZE })
    .withMessage(`Limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`)
    .toInt(),
  query("cursor")
    .optional()
    .custom((value) => mongoose.isValidObjectId(value))
    .withMessage("Cursor must be a valid post id."),
];

export default { createPostRules, exploreRules };
