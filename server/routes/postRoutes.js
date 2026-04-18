import { Router } from "express";

import {
  createPost,
  getPostById,
  getPostsByUsername,
  explorePosts,
  updatePost,
  deletePost,
} from "../controllers/postController.js";
import { toggleLike } from "../controllers/likeController.js";
import {
  createComment,
  getCommentsByPost,
} from "../controllers/commentController.js";
import protect from "../middleware/auth.js";
import optionalAuth from "../middleware/optionalAuth.js";
import { uploadPostImage } from "../middleware/upload.js";
import { writeLimiter } from "../middleware/rateLimiters.js";
import validate from "../middleware/validate.js";
import {
  createPostRules,
  updatePostRules,
  exploreRules,
} from "../validators/postValidator.js";
import { createCommentRules } from "../validators/commentValidator.js";

const router = Router();

// Route ordering note:
// Express matches routes top-to-bottom. The literal `/explore` and the
// nested `/user/:username` MUST be declared before `/:id`, otherwise the
// catch-all `/:id` would swallow them as ids and 404 every request.

// GET /api/posts/explore
// Public trending feed. `optionalAuth` enriches each post with
// `isLikedByMe` for signed-in viewers without forcing them to log in.
router.get("/explore", optionalAuth, validate(exploreRules), explorePosts);

// GET /api/posts/user/:username
// A user's own timeline. Visibility honours per-account privacy: a private
// account's posts return 404 to anyone who isn't the owner or a follower.
router.get("/user/:username", optionalAuth, getPostsByUsername);

// GET /api/posts/:id
// Single post fetch. 404 hides the difference between deleted, hidden and
// privately-restricted posts (anti-enumeration).
router.get("/:id", optionalAuth, getPostById);

// POST /api/posts
// Middleware order is intentional and load-bearing:
//   1. protect         — no anonymous posting; also gives us req.user.
//   2. writeLimiter    — 30/min cap on writes blocks spam before we touch
//                        multer / Cloudinary (cheap pre-filter).
//   3. uploadPostImage — multer parses multipart/form-data into req.file
//                        (in-memory buffer, MIME + size enforced).
//   4. validate(...)   — runs AFTER multer so the validator can see both
//                        req.body.content and req.file together to enforce
//                        "must have content or image".
//   5. createPost      — streams buffer to Cloudinary then persists.
router.post(
  "/",
  protect,
  writeLimiter,
  uploadPostImage,
  validate(createPostRules),
  createPost
);

// PATCH /api/posts/:id
// Owner-or-admin edit. `writeLimiter` blocks edit-spam before validation runs;
// `validate(updatePostRules)` enforces content shape; the controller itself
// performs the ownership check and returns 404 (not 403) for missing posts to
// avoid leaking the existence of hidden / deleted ids.
router.patch("/:id", protect, writeLimiter, validate(updatePostRules), updatePost);

// DELETE /api/posts/:id
// Owner-or-admin delete. Triggers the Post `deleteOne` cascade hook, which
// removes related comments + notifications, deletes the Cloudinary asset and
// decrements the author's `postsCount` in a single hop.
router.delete("/:id", protect, writeLimiter, deletePost);

// POST /api/posts/:id/like
// Idempotent like / unlike toggle. `writeLimiter` (30/min) blocks the
// "spam-like to spam-notify" harassment pattern before the controller
// even runs; the controller itself uses `$addToSet` + a conditional
// `updateOne` so concurrent double-taps cannot drift the counter.
router.post("/:id/like", protect, writeLimiter, toggleLike);

// Comment endpoints are nested under their parent post so the URL space
// stays hierarchical (`/api/posts/:postId/comments`). The standalone
// `DELETE /api/comments/:id` lives in `routes/commentRoutes.js` because
// it has no parent. All three handlers share `controllers/commentController.js`.

// POST /api/posts/:postId/comments
// Authenticated, rate-limited create. `writeLimiter` (30/min) blocks
// comment-spam before validation runs; the controller verifies the post
// exists and is not hidden, then increments the post's `commentsCount`.
router.post(
  "/:postId/comments",
  protect,
  writeLimiter,
  validate(createCommentRules),
  createComment
);

// GET /api/posts/:postId/comments
// Public cursor-paginated list. `optionalAuth` is wired in so future
// per-viewer flags (e.g. "is this my comment?") can be added without a
// route signature change.
router.get("/:postId/comments", optionalAuth, getCommentsByPost);

export default router;
