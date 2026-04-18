import { Router } from "express";

import {
  getUserByUsername,
  getFollowers,
  getFollowing,
  searchUsers,
  updateProfile,
} from "../controllers/userController.js";
import { toggleFollow } from "../controllers/followController.js";

import protect from "../middleware/auth.js";
import optionalAuth from "../middleware/optionalAuth.js";
import validate from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimiters.js";
import { searchRules, updateProfileRules } from "../validators/userValidator.js";

const router = Router();

// Route ordering matters: the literal `/search` and `/me` segments must be
// declared BEFORE the `/:username` parametric segment so Express does not
// treat "search" or "me" as a valid username and route the request into
// `getUserByUsername` instead.

// GET /api/users/search?q=...
// Public autocomplete-style search. `optionalAuth` runs first so the
// controller can exclude the viewer's own account from their results.
// `validate(searchRules)` rejects empty / over-long queries with a clean
// 400 before the controller runs the (already ReDoS-safe) regex.
router.get("/search", optionalAuth, validate(searchRules), searchUsers);

// PATCH /api/users/me
// Self-service profile update. `protect` guarantees `req.user` exists before
// the validator (which references body fields only) runs. The controller
// strictly whitelists `name | bio | username | preferences` — `role`,
// `email`, `followers`, `following`, counters etc. are mass-assignment-proof
// by construction.
router.patch("/me", protect, validate(updateProfileRules), updateProfile);

// GET /api/users/:username
// Public profile lookup. `optionalAuth` is required so the controller can
// branch on viewer presence (privacy gate, `isFollowing` flag, email
// visibility) without making this a fully authenticated route.
router.get("/:username", optionalAuth, getUserByUsername);

// GET /api/users/:username/followers
// GET /api/users/:username/following
// Cursor-paginated mini-profile lists. Same `optionalAuth` reasoning as the
// profile endpoint — private accounts hide their social graph from
// non-followers, which is checked server-side in the controller. The
// controller treats malformed `?cursor` and out-of-range `?limit` as
// defaults, so a dedicated validator chain isn't required here.
router.get("/:username/followers", optionalAuth, getFollowers);
router.get("/:username/following", optionalAuth, getFollowing);

// POST /api/users/:id/follow
// Idempotent follow / unfollow toggle. Middleware order is intentional:
//   1. protect      — anonymous follows make no sense; also gives us req.user.
//   2. writeLimiter — 30/min cap blocks the "spam-follow to spam-notify"
//                     harassment pattern before the controller even runs.
//   3. toggleFollow — uses conditional updates so concurrent double-clicks
//                     cannot drift the followers / following counters.
router.post("/:id/follow", protect, writeLimiter, toggleFollow);

export default router;
