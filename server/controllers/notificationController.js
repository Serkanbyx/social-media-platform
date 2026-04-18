import mongoose from "mongoose";

import Notification from "../models/Notification.js";
import asyncHandler from "../utils/asyncHandler.js";

// Public projections for the populated refs — never leak email, password,
// preferences, the raw `likes` array, etc. through a notification payload.
const SENDER_PUBLIC_FIELDS = "username name avatar";
const POST_PREVIEW_FIELDS = "content image";

// Pagination defaults. The hard cap of 30 protects the DB from unbounded
// queries when a malicious client sends `?limit=99999`, and matches the
// validator clamp in `notificationValidator.js`.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 30;

// How much of the parent post's body we include in a notification payload.
// Anything longer is truncated with an ellipsis so the notification list
// stays compact regardless of how long the original post is.
const POST_PREVIEW_LENGTH = 80;

// Resolve the page size from a query param, clamping into [1, MAX_PAGE_SIZE].
// Falls back to DEFAULT_PAGE_SIZE for any non-numeric / out-of-range input.
const resolveLimit = (raw) => {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
};

// Returns the ObjectId form of a cursor query param, or null when the value
// is missing/invalid. Treating an invalid cursor as "no cursor" keeps the
// endpoint resilient to stale or hand-crafted query strings.
const resolveCursor = (raw) => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (!mongoose.isValidObjectId(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

// Truncate the populated post's content to a fixed preview length so the
// notification list stays compact. Mutates the plain object in place because
// it has already been detached from Mongoose by `.toObject()`.
const truncatePostPreview = (post) => {
  if (!post || typeof post.content !== "string") return;
  if (post.content.length <= POST_PREVIEW_LENGTH) return;
  post.content = `${post.content.slice(0, POST_PREVIEW_LENGTH)}…`;
};

// GET /api/notifications
// Cursor-paginated list scoped to the authenticated viewer. The compound
// `{ recipient: 1, isRead: 1, createdAt: -1 }` index covers the query and
// the `_id` cursor approximates `createdAt` ordering because Mongo's
// ObjectId is monotonic, so each page is an O(limit) index seek.
export const listNotifications = asyncHandler(async (req, res) => {
  const limit = resolveLimit(req.query.limit);
  const cursor = resolveCursor(req.query.cursor);

  const filter = {
    recipient: req.user._id,
    ...(cursor ? { _id: { $lt: cursor } } : {}),
  };

  // Fetch one extra row beyond `limit` so we can compute `hasMore` and the
  // next cursor without a second count query.
  const docs = await Notification.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("sender", SENDER_PUBLIC_FIELDS)
    .populate("post", POST_PREVIEW_FIELDS);

  const hasMore = docs.length > limit;
  const sliced = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(sliced[sliced.length - 1]._id) : null;

  // Transform to plain objects so we can truncate the embedded post preview
  // without mutating the cached Mongoose documents.
  const items = sliced.map((doc) => {
    const plain = doc.toObject();
    truncatePostPreview(plain.post);
    return plain;
  });

  return res.json({
    status: "success",
    items,
    nextCursor,
    hasMore,
  });
});

// GET /api/notifications/unread-count
// Lightweight badge query. The compound index above makes this an O(log n)
// covered count even when the recipient has thousands of notifications.
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  return res.json({ status: "success", count });
});

// PATCH /api/notifications/:id/read
// Recipient-only mutation. We load the doc, verify ownership and only then
// flip the flag; a sender or unrelated user attempting this gets a 403 (and
// missing ids get a 404, never disclosed). The save is skipped when the
// notification is already read so we don't bump `updatedAt` for no reason.
export const markRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res
      .status(404)
      .json({ status: "error", message: "Notification not found." });
  }

  const notification = await Notification.findById(id);
  if (!notification) {
    return res
      .status(404)
      .json({ status: "error", message: "Notification not found." });
  }

  if (!notification.recipient.equals(req.user._id)) {
    return res
      .status(403)
      .json({ status: "error", message: "You are not allowed to modify this notification." });
  }

  if (!notification.isRead) {
    notification.isRead = true;
    await notification.save();
  }

  return res.json({ status: "success", notification });
});

// PATCH /api/notifications/read-all
// Bulk mark-as-read for the authenticated viewer. Filtered on `isRead: false`
// so the write set is exactly the unread documents — Mongo skips the rest
// and the operation is effectively no-op when there's nothing to mark.
export const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true }
  );

  return res.json({
    status: "success",
    modifiedCount: result.modifiedCount ?? 0,
  });
});

// DELETE /api/notifications/:id
// Recipient-only delete. Same 404-vs-403 split as `markRead`: missing ids
// look like "not found", someone else's id looks like "forbidden".
export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res
      .status(404)
      .json({ status: "error", message: "Notification not found." });
  }

  const notification = await Notification.findById(id);
  if (!notification) {
    return res
      .status(404)
      .json({ status: "error", message: "Notification not found." });
  }

  if (!notification.recipient.equals(req.user._id)) {
    return res
      .status(403)
      .json({ status: "error", message: "You are not allowed to delete this notification." });
  }

  await notification.deleteOne();

  return res.json({ status: "success" });
});

export default {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
};
