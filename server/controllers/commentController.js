import mongoose from "mongoose";

import env from "../config/env.js";
import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import { createAndEmit } from "../services/notificationService.js";
import asyncHandler from "../utils/asyncHandler.js";

// Public author projection — never leak email, password, preferences, etc.
const AUTHOR_PUBLIC_FIELDS = "username name avatar";

// Pagination defaults. The hard cap of 50 protects the DB from unbounded
// queries when a malicious client sends `?limit=99999`.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// Resolve the page size from a query param, clamping into [1, MAX_PAGE_SIZE].
// Falls back to DEFAULT_PAGE_SIZE for any non-numeric / out-of-range input.
const resolveLimit = (raw) => {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
};

// Returns the ObjectId form of a cursor query param, or null when the value
// is missing/invalid. Treating an invalid cursor as "no cursor" keeps the
// public endpoints resilient to stale or hand-crafted query strings.
const resolveCursor = (raw) => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (!mongoose.isValidObjectId(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

// POST /api/posts/:postId/comments
// Mass-assignment protected: only `content` is read from the body. The
// author is always taken from the authenticated session and the post id
// always comes from the URL — counters / timestamps cannot be set by the
// client. Returns 404 (not 403) for missing OR hidden posts so a probe
// can't tell admin-hidden content from genuinely deleted content.
export const createComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;

  if (!mongoose.isValidObjectId(postId)) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  // Hidden posts cannot accept new comments — moderation effectively
  // freezes the thread.
  const post = await Post.findOne({ _id: postId, isHidden: false }).select("author");
  if (!post) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    content: typeof content === "string" ? content.trim() : "",
  });

  // Denormalised counter — kept in sync here so feed / post detail can
  // render the comment count without aggregating the Comment collection
  // on every request. Done after Comment.create so a failed insert doesn't
  // bump the counter.
  await Post.findByIdAndUpdate(post._id, { $inc: { commentsCount: 1 } });

  await comment.populate("author", AUTHOR_PUBLIC_FIELDS);

  // Fire the notification AFTER the comment + counter are persisted so we
  // never notify on an action that didn't actually take effect. Wrapped so
  // a notification failure can never turn a successful comment into a 500
  // — the self-comment guard lives inside `createAndEmit` as a
  // defence-in-depth.
  try {
    await createAndEmit({
      recipient: post.author,
      sender: req.user._id,
      type: "comment",
      post: post._id,
    });
  } catch (err) {
    if (!env.isProduction) {
      console.error("[notification] failed to emit comment notification:", err);
    }
  }

  return res.status(201).json({ status: "success", comment });
});

// GET /api/posts/:postId/comments
// Cursor-based pagination keyed on `_id` (descending). Combined with the
// compound `{ post: 1, createdAt: -1 }` index this is an O(limit) seek
// regardless of how deep the thread is.
//
// Public endpoint — `optionalAuth` is wired in so the controller can branch
// on viewer presence later (e.g. flag the viewer's own comments) without
// changing the route.
export const getCommentsByPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const limit = resolveLimit(req.query.limit);
  const cursor = resolveCursor(req.query.cursor);

  if (!mongoose.isValidObjectId(postId)) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  // Hidden posts return an empty thread under the same 404-shape used
  // everywhere else, so a probe can't tell hidden / deleted apart.
  const postExists = await Post.exists({ _id: postId, isHidden: false });
  if (!postExists) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  const filter = {
    post: postId,
    ...(cursor ? { _id: { $lt: cursor } } : {}),
  };

  // Fetch one extra row beyond `limit` so we can compute `hasMore` without
  // a separate count query.
  const docs = await Comment.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", AUTHOR_PUBLIC_FIELDS);

  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

  return res.json({
    status: "success",
    items,
    nextCursor,
    hasMore,
  });
});

// Centralised authorisation check used by `deleteComment`.
// A comment can be removed by:
//   - its author (own content),
//   - the post author (thread moderation — deletes spam on their post),
//   - any admin (global moderation).
// Returning a boolean (rather than throwing) keeps the controller's
// control flow obvious and avoids leaking 403s through the error handler.
const canDeleteComment = (comment, post, user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (comment.author.equals(user._id)) return true;
  if (post && post.author.equals(user._id)) return true;
  return false;
};

// DELETE /api/comments/:id
// Uses the *document* `deleteOne()` so the cascade hook on the Comment
// schema fires: it decrements the parent post's `commentsCount` and
// deletes the matching `comment` notification. A bulk `deleteMany` would
// silently skip that hook and leak orphan data.
export const deleteComment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ status: "error", message: "Comment not found." });
  }

  const comment = await Comment.findById(id);
  if (!comment) {
    return res.status(404).json({ status: "error", message: "Comment not found." });
  }

  // Load the parent post once so we can grant delete rights to the post
  // owner (thread moderation) without a second DB hop in the auth check.
  const post = await Post.findById(comment.post).select("author");

  if (!canDeleteComment(comment, post, req.user)) {
    return res
      .status(403)
      .json({ status: "error", message: "You are not allowed to delete this comment." });
  }

  await comment.deleteOne();

  return res.json({ status: "success" });
});

export default {
  createComment,
  getCommentsByPost,
  deleteComment,
};
