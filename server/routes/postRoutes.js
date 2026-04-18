import { Router } from "express";

import { createPost } from "../controllers/postController.js";
import protect from "../middleware/auth.js";
import { uploadPostImage } from "../middleware/upload.js";
import { writeLimiter } from "../middleware/rateLimiters.js";
import validate from "../middleware/validate.js";
import { createPostRules } from "../validators/postValidator.js";

const router = Router();

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

// Read / update / delete / like routes are filled in STEPS 8–10.

export default router;
