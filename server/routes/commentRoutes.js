import { Router } from "express";

import { deleteComment } from "../controllers/commentController.js";
import protect from "../middleware/auth.js";

const router = Router();

// Route ordering note:
// The post-scoped comment endpoints (POST / GET /api/posts/:postId/comments)
// are mounted via `routes/postRoutes.js` so the `:postId` URL parameter
// stays close to the rest of the post surface. Only the standalone
// `DELETE /api/comments/:id` lives here because it has no parent.

// DELETE /api/comments/:id
// Owner-or-post-author-or-admin delete. Triggers the Comment `deleteOne`
// cascade hook, which decrements the parent post's `commentsCount` and
// removes the matching `comment` notification in a single hop.
router.delete("/:id", protect, deleteComment);

export default router;
