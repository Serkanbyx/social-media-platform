import { body } from "express-validator";

// Mirror the Post model schema so the validator and the DB layer stay in sync.
// Keeping the limit in one source of truth would be ideal — for now, both
// places use the same constant (1000) and any future change must update both.
const MAX_CONTENT_LENGTH = 1000;

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

export default { createPostRules };
