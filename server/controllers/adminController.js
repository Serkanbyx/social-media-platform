import mongoose from "mongoose";

import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import asyncHandler from "../utils/asyncHandler.js";
import escapeRegex from "../utils/escapeRegex.js";

// Pagination defaults for the admin list endpoints. Admin tables are
// page-based (skip/limit + total) rather than cursor-based: a moderator
// usually needs to jump around (page 1 -> page 17 -> last) so a stable
// running cursor would be the wrong UX. The hard caps protect the DB from
// `?limit=99999` even if the admin token leaks.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Window used by the dashboard "new in the last week" tiles. Centralised so
// both the user and post stats agree on the same boundary date.
const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Top-N leaderboard size on the dashboard. Ten matches typical "top users"
// sidebars and keeps the payload small enough to render instantly.
const TOP_USERS_LIMIT = 10;

// Public author projection used inside post / comment list responses. The
// admin still gets the per-user email + counts via the dedicated user
// endpoint; we don't double-leak it here.
const AUTHOR_PUBLIC_FIELDS = "username name avatar";

// Admin-extended user projection. Email and the denormalised counters are
// safe to expose here because the route is gated by `adminOnly` — but we
// still never select the password (it's `select: false` on the schema, so
// this is also belt-and-braces).
const ADMIN_USER_FIELDS =
  "username name email avatar role isActive followersCount followingCount postsCount createdAt updatedAt";

// Resolve a positive integer from a query param, clamping into [min, max].
// Falls back to `fallback` for any non-numeric / out-of-range input so a
// hand-crafted `?page=foo` cannot ever crash the controller.
const resolveInt = (raw, { fallback, min = 1, max }) => {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  if (typeof max === "number" && parsed > max) return max;
  return parsed;
};

// Resolve a tri-state boolean filter from a query param. `undefined` means
// "no filter"; only the literal strings "true" / "false" toggle the flag so
// `?isActive=foo` is treated as "no filter" rather than silently false.
const resolveBoolFilter = (raw) => {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
};

// Lazy resolver for sibling models. The cascade paths below mirror the
// account self-delete in `authController.deleteAccount`; using the same
// helper keeps both call sites resilient to a model not being registered
// yet (e.g. very early boot or an isolated unit test).
const tryGetModel = (name) => {
  try {
    return mongoose.model(name);
  } catch {
    return null;
  }
};

// Cascades a user delete the same way the account self-delete does:
//   - posts authored by the user are removed (likes pointing at the user
//     are stripped from every other post first),
//   - comments authored by the user are removed,
//   - notifications sent OR received by the user are removed,
//   - the user is pulled out of every other user's followers / following
//     arrays and the corresponding counters are decremented.
//
// `deleteMany` intentionally bypasses the per-document cascade hooks (they
// would fan out into N round-trips and we already do the cross-collection
// cleanup here in bulk). The known trade-off is that Cloudinary assets
// owned by the deleted user's posts are left orphaned — the same behaviour
// as the existing `authController.deleteAccount`.
const cascadeUserDelete = async (userId) => {
  await Post.updateMany({ likes: userId }, { $pull: { likes: userId } });
  await Post.deleteMany({ author: userId });
  await Comment.deleteMany({ author: userId });
  await Notification.deleteMany({
    $or: [{ recipient: userId }, { sender: userId }],
  });

  await User.updateMany(
    { followers: userId },
    { $pull: { followers: userId }, $inc: { followersCount: -1 } }
  );
  await User.updateMany(
    { following: userId },
    { $pull: { following: userId }, $inc: { followingCount: -1 } }
  );
};

// Returns the number of currently active admins. Used by the last-admin
// protection: an action that would leave the system with zero active
// admins is rejected so we can never lock ourselves out of moderation.
const countActiveAdmins = () =>
  User.countDocuments({ role: "admin", isActive: true });

// GET /api/admin/stats
//
// Single round-trip dashboard payload. Every count is fired in parallel
// via `Promise.all` because the queries touch different collections and
// have no ordering dependency. The aggregation for total likes uses the
// denormalised `likesCount` so we don't have to traverse the embedded
// `likes` arrays at the storage layer.
export const getDashboardStats = asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - TRENDING_WINDOW_MS);

  const [
    totalUsers,
    activeUsers,
    newUsers7d,
    totalPosts,
    hiddenPosts,
    newPosts7d,
    totalComments,
    likesAggregate,
    topUsers,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: since } }),
    Post.countDocuments({}),
    Post.countDocuments({ isHidden: true }),
    Post.countDocuments({ createdAt: { $gte: since } }),
    Comment.countDocuments({}),
    Post.aggregate([{ $group: { _id: null, total: { $sum: "$likesCount" } } }]),
    User.find({ isActive: true })
      .sort({ followersCount: -1, _id: -1 })
      .limit(TOP_USERS_LIMIT)
      .select("username name avatar followersCount"),
  ]);

  const totalLikes = likesAggregate.length > 0 ? likesAggregate[0].total : 0;

  return res.json({
    status: "success",
    stats: {
      users: {
        total: totalUsers,
        active: activeUsers,
        newLast7Days: newUsers7d,
      },
      posts: {
        total: totalPosts,
        hidden: hiddenPosts,
        newLast7Days: newPosts7d,
      },
      comments: { total: totalComments },
      likes: { total: totalLikes },
      topUsers,
    },
  });
});

// GET /api/admin/users
//
// Page-based admin listing with optional filters. The `q` filter runs as
// an anchored, case-insensitive regex on `username` and `name`; anchoring
// keeps the query index-friendly and `escapeRegex` neutralises every
// metacharacter so a crafted query (`(a+)+$`) cannot pin the event loop.
//
// Email is excluded from the search surface deliberately — admins can
// look up an account by email through a future dedicated endpoint without
// exposing a free-text email scanner that would help an attacker who
// stole an admin token enumerate the user base.
export const listUsers = asyncHandler(async (req, res) => {
  const page = resolveInt(req.query.page, { fallback: 1, min: 1 });
  const limit = resolveInt(req.query.limit, {
    fallback: DEFAULT_PAGE_SIZE,
    min: 1,
    max: MAX_PAGE_SIZE,
  });

  const filter = {};

  const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (rawQuery.length > 0) {
    const prefix = new RegExp(`^${escapeRegex(rawQuery)}`, "i");
    filter.$or = [{ username: prefix }, { name: prefix }];
  }

  if (req.query.role === "user" || req.query.role === "admin") {
    filter.role = req.query.role;
  }

  const isActive = resolveBoolFilter(req.query.isActive);
  if (typeof isActive === "boolean") filter.isActive = isActive;

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(ADMIN_USER_FIELDS),
    User.countDocuments(filter),
  ]);

  return res.json({
    status: "success",
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

// PATCH /api/admin/users/:id/role
//
// Role transitions are guarded by two protections:
//   1. Self-protection — an admin cannot demote themselves. A moderator
//      who accidentally clicks "make user" on their own row would lock
//      themselves out instantly; we 400 instead.
//   2. Last-admin protection — if downgrading would leave the system
//      with zero active admins we reject the change. The check uses
//      `countDocuments({ role: 'admin', isActive: true })` so a future
//      flag (deactivated admin) is automatically counted out.
//
// 404 is returned for unknown ids so a probe via this endpoint cannot
// enumerate which `_id`s correspond to real users.
export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  if (String(id) === String(req.user._id) && role !== "admin") {
    return res.status(400).json({
      status: "error",
      message: "You cannot change your own admin role.",
    });
  }

  const target = await User.findById(id);
  if (!target) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  if (target.role === role) {
    return res.json({
      status: "success",
      user: target.toPublicProfile({ viewerId: req.user._id }),
    });
  }

  if (target.role === "admin" && role !== "admin" && target.isActive) {
    const remaining = await countActiveAdmins();
    if (remaining <= 1) {
      return res.status(400).json({
        status: "error",
        message: "At least one active admin must remain.",
      });
    }
  }

  target.role = role;
  await target.save();

  return res.json({
    status: "success",
    user: target.toPublicProfile({ viewerId: req.user._id }),
  });
});

// PATCH /api/admin/users/:id/active
//
// Enable / disable a user account. Same self-protection and last-admin
// protection as the role endpoint — a moderator cannot deactivate
// themselves and we never let the platform end up with zero active
// admins. A deactivated user is treated as "not found" by every public
// read endpoint, so this is the soft-delete switch admins reach for
// when they want to suspend an account without losing its content.
export const setUserActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  if (String(id) === String(req.user._id) && isActive === false) {
    return res.status(400).json({
      status: "error",
      message: "You cannot deactivate your own account.",
    });
  }

  const target = await User.findById(id);
  if (!target) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  if (target.isActive === isActive) {
    return res.json({
      status: "success",
      user: target.toPublicProfile({ viewerId: req.user._id }),
    });
  }

  if (target.role === "admin" && target.isActive && isActive === false) {
    const remaining = await countActiveAdmins();
    if (remaining <= 1) {
      return res.status(400).json({
        status: "error",
        message: "At least one active admin must remain.",
      });
    }
  }

  target.isActive = isActive;
  await target.save();

  return res.json({
    status: "success",
    user: target.toPublicProfile({ viewerId: req.user._id }),
  });
});

// DELETE /api/admin/users/:id
//
// Hard delete with the same cascade as the account self-delete. Same
// self-protection + last-admin protection as the role / active endpoints
// so an admin can never delete themselves through this route or remove
// the final active admin.
export const deleteUserAsAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  if (String(id) === String(req.user._id)) {
    return res.status(400).json({
      status: "error",
      message: "You cannot delete your own account.",
    });
  }

  const target = await User.findById(id);
  if (!target) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  if (target.role === "admin" && target.isActive) {
    const remaining = await countActiveAdmins();
    if (remaining <= 1) {
      return res.status(400).json({
        status: "error",
        message: "At least one active admin must remain.",
      });
    }
  }

  await cascadeUserDelete(target._id);
  await target.deleteOne();

  return res.json({ status: "success" });
});

// PATCH /api/admin/posts/:id/hide
//
// Toggles the `isHidden` moderation flag. Public read endpoints filter
// `isHidden: false` so a hidden post becomes invisible everywhere except
// in the admin tools. We always echo back the fresh post so the moderator
// UI can re-render without an extra GET.
export const hidePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  const post = await Post.findById(id);
  if (!post) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  post.isHidden = !post.isHidden;
  await post.save();
  await post.populate("author", AUTHOR_PUBLIC_FIELDS);

  return res.json({ status: "success", post });
});

// DELETE /api/admin/posts/:id
//
// Hard delete via the *document* `deleteOne()` so the Post schema's
// cascade hook fires (removes related comments / notifications / the
// Cloudinary asset and decrements the author's `postsCount`).
export const deletePostAsAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  const post = await Post.findById(id);
  if (!post) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  await post.deleteOne();

  return res.json({ status: "success" });
});

// DELETE /api/admin/comments/:id
//
// Hard delete via the *document* `deleteOne()` so the Comment schema's
// cascade hook fires (decrements the parent post's `commentsCount` and
// removes the matching `comment` notification).
export const deleteCommentAsAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ status: "error", message: "Comment not found." });
  }

  const comment = await Comment.findById(id);
  if (!comment) {
    return res.status(404).json({ status: "error", message: "Comment not found." });
  }

  await comment.deleteOne();

  return res.json({ status: "success" });
});

// GET /api/admin/posts
//
// Page-based admin listing of every post — including hidden ones, which
// the public `/api/posts/explore` endpoint filters out. The optional
// `?isHidden=true|false` filter lets a moderator focus on one bucket at
// a time, and `?q=` runs a content substring match (case-insensitive,
// `escapeRegex` neutralises every metacharacter so a crafted query
// cannot pin the event loop). The author is populated with the same
// public projection used elsewhere so the admin table can render
// usernames + avatars without joining client-side.
export const listAllPosts = asyncHandler(async (req, res) => {
  const page = resolveInt(req.query.page, { fallback: 1, min: 1 });
  const limit = resolveInt(req.query.limit, {
    fallback: DEFAULT_PAGE_SIZE,
    min: 1,
    max: MAX_PAGE_SIZE,
  });

  const filter = {};
  const isHidden = resolveBoolFilter(req.query.isHidden);
  if (typeof isHidden === "boolean") filter.isHidden = isHidden;

  const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (rawQuery.length > 0) {
    filter.content = new RegExp(escapeRegex(rawQuery), "i");
  }

  const [items, total] = await Promise.all([
    Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", AUTHOR_PUBLIC_FIELDS),
    Post.countDocuments(filter),
  ]);

  return res.json({
    status: "success",
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

// GET /api/admin/comments
//
// Page-based admin listing of every comment. The post + author are both
// populated so the moderator table has enough context to triage without
// extra round-trips. Hidden parent posts are still listed because a
// moderator may want to clean up the comments under a freshly-hidden
// post. `?q=` runs a content substring match with the same regex
// hardening as every other admin search surface.
export const listAllComments = asyncHandler(async (req, res) => {
  const page = resolveInt(req.query.page, { fallback: 1, min: 1 });
  const limit = resolveInt(req.query.limit, {
    fallback: DEFAULT_PAGE_SIZE,
    min: 1,
    max: MAX_PAGE_SIZE,
  });

  const filter = {};
  const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (rawQuery.length > 0) {
    filter.content = new RegExp(escapeRegex(rawQuery), "i");
  }

  const [items, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", AUTHOR_PUBLIC_FIELDS)
      .populate("post", "content isHidden createdAt"),
    Comment.countDocuments(filter),
  ]);

  return res.json({
    status: "success",
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export default {
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
};
