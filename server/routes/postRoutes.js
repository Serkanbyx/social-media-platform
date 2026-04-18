import { Router } from "express";

import {
  createPost,
  getPostById,
  getPostsByUsername,
  explorePosts,
} from "../controllers/postController.js";
import protect from "../middleware/auth.js";
import optionalAuth from "../middleware/optionalAuth.js";
import { uploadPostImage } from "../middleware/upload.js";
import { writeLimiter } from "../middleware/rateLimiters.js";
import validate from "../middleware/validate.js";
import { createPostRules, exploreRules } from "../validators/postValidator.js";

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

// Update / delete / like routes are filled in STEPS 9–10.

export default router;
