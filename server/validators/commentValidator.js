import { body } from "express-validator";

// Mirror of the Comment model schema cap. Both files share the literal 500
// today; any future change must update both sources of truth.
const MAX_COMMENT_LENGTH = 500;

// Validation rules for `POST /api/posts/:postId/comments`.
//
// `content` is the only writable field — author and post are derived from
// `req.user` and the URL respectively in the controller, so mass-assignment
// of `author`, `post`, `createdAt` etc. is impossible by construction.
//
// `escape()` neutralises HTML metacharacters at the storage layer as a
// defence-in-depth: even if a future client forgets to encode comment text
// before injecting it into the DOM, the persisted value cannot carry a live
// `<script>` payload.
export const createCommentRules = [
  body("content")
    .exists({ checkNull: true })
    .withMessage("Comment content is required.")
    .bail()
    .isString()
    .withMessage("Comment content must be a string.")
    .bail()
    .trim()
    .isLength({ min: 1, max: MAX_COMMENT_LENGTH })
    .withMessage(`Comment must be between 1 and ${MAX_COMMENT_LENGTH} characters.`)
    .escape(),
];

export default { createCommentRules };
