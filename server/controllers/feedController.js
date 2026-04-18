import mongoose from "mongoose";

import Post from "../models/Post.js";
import asyncHandler from "../utils/asyncHandler.js";

// Public projection for the embedded author — never leak email, password,
// preferences or any other private field through a list endpoint.
const AUTHOR_PUBLIC_FIELDS = "username name avatar";

// Pagination clamps. The hard cap of 20 protects the DB from unbounded
// queries; the default of 10 matches the typical "screen full" on mobile.
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 20;

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

// GET /api/feed
// Personalized timeline — posts authored by the people the viewer follows
// plus the viewer's own posts, newest first. Cursor-based pagination over
// `_id` keeps each page O(log n) regardless of how deep the user scrolls;
// the existing `{ author: 1, createdAt: -1 }` index covers the query and
// `_id` ordering equals `createdAt` ordering because ObjectId is monotonic.
export const getFeed = asyncHandler(async (req, res) => {
  const limit = resolveLimit(req.query.limit);
  const cursor = resolveCursor(req.query.cursor);

  // Following list + the viewer themselves, so a user's own posts appear in
  // their feed even before they follow anyone.
  const authorIds = [...req.user.following, req.user._id];

  const filter = {
    author: { $in: authorIds },
    isHidden: false,
    ...(cursor ? { _id: { $lt: cursor } } : {}),
  };

  // Fetch one extra row beyond `limit` so we can compute `hasMore` and the
  // next cursor without a second count query.
  const docs = await Post.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", AUTHOR_PUBLIC_FIELDS);

  const hasMore = docs.length > limit;
  const sliced = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(sliced[sliced.length - 1]._id) : null;

  // Strip the raw `likes` array from the response — at scale it grows
  // unbounded and would leak who-likes-what. We only emit a per-viewer
  // boolean derived from it.
  const viewerKey = String(req.user._id);
  const items = sliced.map((post) => {
    const plain = typeof post.toObject === "function" ? post.toObject() : post;
    const isLikedByMe = Array.isArray(plain.likes)
      ? plain.likes.some((likeId) => String(likeId) === viewerKey)
      : false;
    delete plain.likes;
    return { ...plain, isLikedByMe };
  });

  return res.json({
    status: "success",
    items,
    nextCursor,
    hasMore,
  });
});

export default { getFeed };
