import mongoose from "mongoose";

import Post from "../models/Post.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import escapeRegex from "../utils/escapeRegex.js";
import { uploadBuffer, destroyByPublicId } from "../config/cloudinary.js";

// Cloudinary folder is namespaced per asset class so post-image cleanup
// can never accidentally touch avatars (or vice versa) and we can apply
// per-folder transformation presets later without changing controller code.
const POST_IMAGE_FOLDER = "social/posts";

// Public author projection — never leak email, password, preferences, etc.
const AUTHOR_PUBLIC_FIELDS = "username name avatar";

// Pagination defaults. The hard cap of 30 protects the DB from unbounded
// queries when a malicious client sends `?limit=99999`.
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 30;

// Trending window — a post counts as "trending" only while it's fresh.
// Anything older than this rolls off the explore feed regardless of likes.
const TRENDING_WINDOW_DAYS = 7;

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

// Fetch one extra row beyond the requested page size; if it comes back, we
// know there's more data and use the last *requested* item's id as the next
// cursor. The extra row is sliced off before the response is sent.
const buildPage = (docs, limit) => {
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;
  return { items, nextCursor, hasMore };
};

// Adds an `isLikedByMe` boolean to each post, computed from the in-memory
// likes array. We only run this when there's an authenticated viewer so
// guest responses stay byte-identical regardless of any side effects.
const decorateLikedByViewer = (posts, viewerId) => {
  if (!viewerId) return posts;
  const viewerKey = String(viewerId);
  return posts.map((post) => {
    const plain = typeof post.toObject === "function" ? post.toObject() : post;
    const isLikedByMe = Array.isArray(plain.likes)
      ? plain.likes.some((id) => String(id) === viewerKey)
      : false;
    return { ...plain, isLikedByMe };
  });
};

// POST /api/posts
// Mass-assignment protected: only `content` is read from the body. The author
// is always taken from the authenticated session and counters / moderation
// flags can never be set by the client.
export const createPost = asyncHandler(async (req, res) => {
  const { content } = req.body;

  const draft = {
    author: req.user._id,
    content: typeof content === "string" ? content.trim() : "",
  };

  // Stream the in-memory buffer to Cloudinary BEFORE we hit the DB so we know
  // the asset URL up-front. We keep a handle to the upload result so a later
  // DB failure can roll the orphan asset back.
  let uploaded = null;
  if (req.file?.buffer) {
    uploaded = await uploadBuffer(req.file.buffer, POST_IMAGE_FOLDER);
    draft.image = {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    };
  }

  let post;
  try {
    post = await Post.create(draft);
  } catch (error) {
    // Roll back the orphan Cloudinary asset so a failed insert (validation
    // error, transient connection drop, etc.) doesn't leave the bucket with
    // a file that no Post document ever referenced.
    if (uploaded?.public_id) {
      await destroyByPublicId(uploaded.public_id);
    }
    throw error;
  }

  // Denormalised counter — kept in sync here so profile pages can render the
  // post count without aggregating the Post collection on every request.
  // Done after Post.create so a failed insert doesn't bump the counter.
  await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });

  await post.populate("author", AUTHOR_PUBLIC_FIELDS);

  return res.status(201).json({
    status: "success",
    post,
  });
});

// GET /api/posts/:id
// Public single-post fetch. Hidden posts and posts authored by deactivated
// users are treated as "not found" — we never differentiate between the
// real causes so a probe can't tell a hidden post from a deleted one.
export const getPostById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  const post = await Post.findOne({ _id: id, isHidden: false }).populate(
    "author",
    `${AUTHOR_PUBLIC_FIELDS} isActive preferences.privacy.privateAccount followers`
  );

  if (!post || !post.author || !post.author.isActive) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  // Server-side privacy: a private account's posts are visible only to its
  // followers and to the owner themselves. Anonymous viewers are never
  // followers, so they're always denied.
  const isPrivate = post.author.preferences?.privacy?.privateAccount === true;
  if (isPrivate) {
    const viewerId = req.user?._id;
    const isOwner = viewerId && String(viewerId) === String(post.author._id);
    const isFollower =
      viewerId &&
      Array.isArray(post.author.followers) &&
      post.author.followers.some((followerId) => String(followerId) === String(viewerId));

    if (!isOwner && !isFollower) {
      return res.status(404).json({ status: "error", message: "Post not found." });
    }
  }

  // Strip the privacy/follower fields we only fetched for the gate check —
  // the public response should expose the same author shape as the list
  // endpoints (`username name avatar`).
  const plain = post.toObject();
  plain.author = {
    _id: plain.author._id,
    username: plain.author.username,
    name: plain.author.name,
    avatar: plain.author.avatar,
  };

  const viewerId = req.user?._id;
  if (viewerId) {
    const viewerKey = String(viewerId);
    plain.isLikedByMe = Array.isArray(plain.likes)
      ? plain.likes.some((likeId) => String(likeId) === viewerKey)
      : false;
  }

  return res.json({ status: "success", post: plain });
});

// GET /api/posts/user/:username
// Profile timeline. Cursor is the `_id` of the last post on the previous
// page; combined with the descending `_id` sort this gives stable
// pagination even while new posts are being created.
export const getPostsByUsername = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const limit = resolveLimit(req.query.limit);
  const cursor = resolveCursor(req.query.cursor);

  // Username comes straight from the URL. We lowercase it ourselves rather
  // than relying on the User schema's normalisation because findOne does
  // not run setters.
  const author = await User.findOne({
    username: typeof username === "string" ? username.toLowerCase() : "",
  });

  if (!author || !author.isActive) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  const isPrivate = author.preferences?.privacy?.privateAccount === true;
  if (isPrivate) {
    const viewerId = req.user?._id;
    const isOwner = viewerId && String(viewerId) === String(author._id);
    const isFollower =
      viewerId && author.followers.some((followerId) => String(followerId) === String(viewerId));

    if (!isOwner && !isFollower) {
      return res.status(404).json({ status: "error", message: "User not found." });
    }
  }

  const filter = {
    author: author._id,
    isHidden: false,
    ...(cursor ? { _id: { $lt: cursor } } : {}),
  };

  // Fetch one extra row beyond `limit` so we can compute `hasMore` without
  // a separate count query.
  const docs = await Post.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", AUTHOR_PUBLIC_FIELDS);

  const { items, nextCursor, hasMore } = buildPage(docs, limit);
  const decorated = decorateLikedByViewer(items, req.user?._id);

  return res.json({
    status: "success",
    items: decorated,
    nextCursor,
    hasMore,
  });
});

// GET /api/posts/explore
// Trending feed: posts created in the last 7 days, ranked by likesCount and
// then by recency. Optional full-text search via `?q=` runs as an escaped
// regex on the `content` field (case-insensitive, ReDoS-safe).
export const explorePosts = asyncHandler(async (req, res) => {
  const limit = resolveLimit(req.query.limit);
  const cursor = resolveCursor(req.query.cursor);
  const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const filter = {
    isHidden: false,
    createdAt: { $gte: since },
    ...(cursor ? { _id: { $lt: cursor } } : {}),
  };

  if (rawQuery.length > 0) {
    // `escapeRegex` neutralises every regex metacharacter and clamps length —
    // safe to feed straight into Mongo's `$regex`.
    filter.content = { $regex: escapeRegex(rawQuery), $options: "i" };
  }

  // Sorting on `_id` last gives us a deterministic tiebreaker so the cursor
  // (`_id < lastId`) approximates a stable page boundary even when many
  // posts share the same likesCount.
  const docs = await Post.find(filter)
    .sort({ likesCount: -1, createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate("author", AUTHOR_PUBLIC_FIELDS);

  const { items, nextCursor, hasMore } = buildPage(docs, limit);
  const decorated = decorateLikedByViewer(items, req.user?._id);

  return res.json({
    status: "success",
    items: decorated,
    nextCursor,
    hasMore,
  });
});

export default { createPost, getPostById, getPostsByUsername, explorePosts };
