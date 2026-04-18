import { Router } from "express";

import { getFeed } from "../controllers/feedController.js";
import protect from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { feedRules } from "../validators/feedValidator.js";

const router = Router();

// GET /api/feed
// Authenticated, personalized timeline. `protect` runs first so an
// unauthenticated request short-circuits before we touch the validator
// or the DB. `validate(feedRules)` then rejects malformed pagination
// params (bad cursor / out-of-range limit) with a clean 400.
router.get("/", protect, validate(feedRules), getFeed);

export default router;
