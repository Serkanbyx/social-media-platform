import { Router } from "express";

import {
  getDashboardStats,
  listUsers,
  updateUserRole,
  setUserActive,
  deleteUserAsAdmin,
  hidePost,
  deletePostAsAdmin,
  deleteCommentAsAdmin,
  listAllPosts,
  listAllComments,
} from "../controllers/adminController.js";

import protect from "../middleware/auth.js";
import adminOnly from "../middleware/adminOnly.js";
import { adminLimiter } from "../middleware/rateLimiters.js";
import validate from "../middleware/validate.js";
import {
  listUsersRules,
  updateUserRoleRules,
  setUserActiveRules,
  listPostsRules,
  listCommentsRules,
} from "../validators/adminValidator.js";

const router = Router();

// Every admin endpoint shares the same gate stack — apply it once at the
// router level so a future handler cannot accidentally be added without
// the protection. Order is intentional and load-bearing:
//   1. protect      — verifies the JWT and attaches req.user.
//   2. adminOnly    — must run AFTER protect so req.user is guaranteed.
//                     Returns 401 for anonymous and 403 for non-admins so
//                     the client can distinguish "log in" from "you can't".
//   3. adminLimiter — 100 admin requests per 15 minutes per IP. Keeps a
//                     leaked admin token from being used to dump the
//                     entire user / post / comment surface in seconds.
router.use(protect, adminOnly, adminLimiter);

// GET /api/admin/stats
// Single round-trip dashboard payload — user / post / comment / like
// counts plus the top-N users by follower count.
router.get("/stats", getDashboardStats);

// User moderation surface.
//
// GET    /api/admin/users          paginated list with optional filters
// PATCH  /api/admin/users/:id/role role transition (self + last-admin protected)
// PATCH  /api/admin/users/:id/active enable / disable account (same protections)
// DELETE /api/admin/users/:id      hard delete with cascade (same protections)
router.get("/users", validate(listUsersRules), listUsers);
router.patch("/users/:id/role", validate(updateUserRoleRules), updateUserRole);
router.patch("/users/:id/active", validate(setUserActiveRules), setUserActive);
router.delete("/users/:id", deleteUserAsAdmin);

// Post moderation surface.
//
// GET    /api/admin/posts          paginated list, includes hidden posts
// PATCH  /api/admin/posts/:id/hide toggle the `isHidden` flag
// DELETE /api/admin/posts/:id      hard delete via document deleteOne
//                                  (fires the cascade hook)
router.get("/posts", validate(listPostsRules), listAllPosts);
router.patch("/posts/:id/hide", hidePost);
router.delete("/posts/:id", deletePostAsAdmin);

// Comment moderation surface.
//
// GET    /api/admin/comments       paginated list across every post
// DELETE /api/admin/comments/:id   hard delete via document deleteOne
//                                  (fires the cascade hook)
router.get("/comments", validate(listCommentsRules), listAllComments);
router.delete("/comments/:id", deleteCommentAsAdmin);

export default router;
