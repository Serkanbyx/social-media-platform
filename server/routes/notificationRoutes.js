import { Router } from "express";

import {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
} from "../controllers/notificationController.js";
import protect from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimiters.js";
import validate from "../middleware/validate.js";
import { listNotificationsRules } from "../validators/notificationValidator.js";

const router = Router();

// Route ordering note:
// Express matches routes top-to-bottom. The literal `/unread-count` and
// `/read-all` MUST be declared before any `:id`-style route so the
// catch-all parameter cannot swallow them and trigger a 404 / 403.

// GET /api/notifications
// Authenticated, cursor-paginated list scoped to the viewer. `protect`
// runs first so an unauthenticated request short-circuits before we
// touch the validator or the DB. `validate(listNotificationsRules)`
// then rejects malformed pagination params with a clean 400.
router.get("/", protect, validate(listNotificationsRules), listNotifications);

// GET /api/notifications/unread-count
// Lightweight badge query. No validator — the endpoint takes no params.
router.get("/unread-count", protect, getUnreadCount);

// PATCH /api/notifications/read-all
// Bulk mark-as-read. `writeLimiter` (30/min) blocks abusive clients from
// hammering the endpoint and triggering repeated bulk writes.
router.patch("/read-all", protect, writeLimiter, markAllRead);

// PATCH /api/notifications/:id/read
// Recipient-only single-item mutation. The controller verifies ownership
// and returns 403 if the viewer isn't the recipient (404 for missing ids).
router.patch("/:id/read", protect, writeLimiter, markRead);

// DELETE /api/notifications/:id
// Recipient-only delete. Same ownership / 404-vs-403 split as `markRead`.
router.delete("/:id", protect, writeLimiter, deleteNotification);

export default router;
