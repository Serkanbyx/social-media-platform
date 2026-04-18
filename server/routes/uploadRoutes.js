import { Router } from "express";

import { uploadAvatar as uploadAvatarController } from "../controllers/uploadController.js";
import { uploadAvatar as uploadAvatarMulter } from "../middleware/upload.js";
import protect from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimiters.js";

const router = Router();

// POST /api/uploads/avatar
// Order is intentional:
//   1. protect      — no anonymous uploads, also gives us req.user.
//   2. writeLimiter — caps upload spam (30/min) before we touch multer.
//   3. multer       — parses multipart/form-data into req.file (memory).
//   4. controller   — streams buffer to Cloudinary and swaps the avatar.
router.post(
  "/avatar",
  protect,
  writeLimiter,
  uploadAvatarMulter,
  uploadAvatarController
);

export default router;
