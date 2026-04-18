import { Router } from "express";

import { toggleFollow } from "../controllers/followController.js";
import protect from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimiters.js";

const router = Router();

// POST /api/users/:id/follow
// Idempotent follow / unfollow toggle. Middleware order is intentional:
//   1. protect      — anonymous follows make no sense; also gives us req.user.
//   2. writeLimiter — 30/min cap blocks the "spam-follow to spam-notify"
//                     harassment pattern before the controller even runs.
//   3. toggleFollow — uses conditional updates so concurrent double-clicks
//                     cannot drift the followers / following counters.
router.post("/:id/follow", protect, writeLimiter, toggleFollow);

// Followers / Following list endpoints arrive in STEP 13.
// Profile read endpoint arrives in STEP 31.

export default router;
