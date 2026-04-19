import mongoose from "mongoose";

import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import escapeRegex from "../utils/escapeRegex.js";

// Public mini-profile projection — never leak email, password, preferences,
// follower/following arrays, or counters that aren't part of the card view.
const MINI_PROFILE_FIELDS = "username name avatar";

// Followers / following list rows additionally carry `bio` so the
// `UserCard` row can show a one-line bio, and (when the viewer is signed
// in) a per-row `isFollowing` flag so the inline Follow button knows which
// state to render without an extra round trip.
const FOLLOW_LIST_FIELDS = "username name avatar bio";

// Pagination defaults for the followers / following lists. The hard cap of
// 50 protects the DB from unbounded queries when a malicious client sends
// `?limit=99999`.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// Search-result page size. 20 matches typical autocomplete UIs and keeps the
// payload light enough to render instantly while the user keeps typing.
const SEARCH_LIMIT = 20;

// Suggestions endpoint defaults / cap. Kept small because the result is
// rendered as a discovery rail, not an infinite list — the UI only ever
// shows a handful of cards at a time.
const SUGGESTIONS_DEFAULT_LIMIT = 10;
const SUGGESTIONS_MAX_LIMIT = 30;

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

// Lower-cases a username taken straight from the URL. The User schema stores
// every username in lowercase, but `findOne` does not run the schema setters
// so we have to normalise the lookup key ourselves.
const normaliseUsername = (raw) =>
  typeof raw === "string" ? raw.trim().toLowerCase() : "";

// Returns true when `viewer` (may be null) is allowed to see private content
// owned by `target`. Owners always pass; anonymous viewers never do.
const canSeePrivate = (target, viewer) => {
  if (!viewer) return false;
  if (String(viewer._id) === String(target._id)) return true;
  return Array.isArray(target.followers)
    ? target.followers.some((followerId) => String(followerId) === String(viewer._id))
    : false;
};

// GET /api/users/:username
//
// Public profile lookup. Privacy is enforced server-side: when the target
// account is private and the viewer is neither the owner nor a follower we
// return a stripped-down profile (username, name, avatar, bio, counts) with
// `isPrivate: true`. The viewer can still see the account exists — they
// just can't see its content — which matches the UX of every major social
// platform and lets the client render a "Request to follow" CTA.
//
// 404 (not 403) is returned for unknown / inactive accounts so a probe can't
// distinguish deactivated users from accounts that never existed.
export const getUserByUsername = asyncHandler(async (req, res) => {
  const username = normaliseUsername(req.params.username);
  if (!username) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  const target = await User.findOne({ username });
  if (!target || !target.isActive) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  const viewerId = req.user?._id ?? null;
  const isOwner = viewerId && String(viewerId) === String(target._id);
  const isPrivate = target.preferences?.privacy?.privateAccount === true;

  // Build the full profile via the model helper so the email / preferences
  // gating stays in one place. We compute `isFollowing` server-side too so
  // the client can render the follow button without a separate round trip.
  const isFollowing =
    viewerId && Array.isArray(target.followers)
      ? target.followers.some((followerId) => String(followerId) === String(viewerId))
      : false;

  if (isPrivate && !isOwner && !isFollowing) {
    return res.json({
      status: "success",
      user: {
        _id: target._id,
        username: target.username,
        name: target.name,
        avatar: target.avatar
          ? { url: target.avatar.url || "", publicId: target.avatar.publicId || "" }
          : { url: "", publicId: "" },
        bio: target.bio,
        followersCount: target.followersCount,
        followingCount: target.followingCount,
        postsCount: target.postsCount,
        isPrivate: true,
        isFollowing: false,
      },
    });
  }

  const profile = target.toPublicProfile({ viewerId });
  profile.isPrivate = isPrivate;
  profile.isFollowing = Boolean(isFollowing);

  return res.json({ status: "success", user: profile });
});

// Shared paginator for the followers / following list endpoints. Both lists
// share the exact same shape: take the target's id-array, query the User
// collection for active accounts whose `_id` is in that array, sort
// descending by `_id` and paginate with a `_id < cursor` filter.
//
// The cursor is the `_id` of the LAST user on the previous page; combined
// with the descending sort this gives stable pagination even while new
// follows are happening. We fetch one extra row to compute `hasMore`
// without a separate `countDocuments` query.
const paginateUserList = async ({ ids, cursor, limit, viewer }) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const filter = {
    _id: { $in: ids, ...(cursor ? { $lt: cursor } : {}) },
    isActive: true,
  };

  const docs = await User.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .select(FOLLOW_LIST_FIELDS);

  const hasMore = docs.length > limit;
  const sliced = hasMore ? docs.slice(0, limit) : docs;

  // Pre-build a Set of the viewer's followed ids so the per-row decoration
  // is O(1) instead of an O(N*M) scan. Anonymous viewers get `isFollowing:
  // false` everywhere — the client uses this only to decide between the
  // "Follow" and "Following" affordances; an anonymous click is then
  // intercepted by `FollowButton`'s `onRequireAuth` callback.
  const followingSet = new Set(
    Array.isArray(viewer?.following)
      ? viewer.following.map((id) => String(id))
      : []
  );
  const viewerIdStr = viewer?._id ? String(viewer._id) : null;

  const items = sliced.map((doc) => {
    const idStr = String(doc._id);
    return {
      _id: doc._id,
      username: doc.username,
      name: doc.name,
      avatar: doc.avatar
        ? { url: doc.avatar.url || "", publicId: doc.avatar.publicId || "" }
        : { url: "", publicId: "" },
      bio: doc.bio || "",
      isFollowing: viewerIdStr ? followingSet.has(idStr) : false,
      isSelf: viewerIdStr ? viewerIdStr === idStr : false,
    };
  });

  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

  return { items, nextCursor, hasMore };
};

// GET /api/users/:username/followers
// GET /api/users/:username/following
//
// Both endpoints share the same privacy gate as the profile endpoint: a
// private account's social graph is hidden from non-followers. Anonymous
// viewers and signed-in non-followers receive a 403 — distinct from 404 so
// the client can render an explanatory empty state instead of looking like
// the user vanished.
const buildFollowListHandler = (relation) =>
  asyncHandler(async (req, res) => {
    const username = normaliseUsername(req.params.username);
    if (!username) {
      return res.status(404).json({ status: "error", message: "User not found." });
    }

    const target = await User.findOne({ username });
    if (!target || !target.isActive) {
      return res.status(404).json({ status: "error", message: "User not found." });
    }

    const isPrivate = target.preferences?.privacy?.privateAccount === true;
    if (isPrivate && !canSeePrivate(target, req.user)) {
      return res.status(403).json({
        status: "error",
        message: "This account is private.",
      });
    }

    const ids = relation === "followers" ? target.followers : target.following;
    const limit = resolveLimit(req.query.limit);
    const cursor = resolveCursor(req.query.cursor);

    const page = await paginateUserList({
      ids,
      cursor,
      limit,
      viewer: req.user || null,
    });

    return res.json({
      status: "success",
      items: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    });
  });

export const getFollowers = buildFollowListHandler("followers");
export const getFollowing = buildFollowListHandler("following");

// GET /api/users/search?q=...
//
// Case-insensitive PREFIX search across `username` and `name`. Anchoring
// the regex with `^` keeps the search index-friendly (avoids a full
// collection scan on a `.*term.*` pattern) and matches typical autocomplete
// behaviour on social platforms.
//
// `escapeRegex` neutralises every regex metacharacter and clamps length, so
// the value handed to Mongo's `$regex` is always a literal string — ReDoS
// is impossible by construction.
//
// Inactive accounts are excluded so deactivated users never resurface in
// search results. The viewer themselves is also excluded — searching for
// yourself in your own follow picker is just noise.
export const searchUsers = asyncHandler(async (req, res) => {
  const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (rawQuery.length === 0) {
    return res.json({ status: "success", items: [] });
  }

  const safe = escapeRegex(rawQuery);
  const prefix = new RegExp(`^${safe}`, "i");

  const filter = {
    isActive: true,
    $or: [{ username: prefix }, { name: prefix }],
  };

  if (req.user?._id) {
    filter._id = { $ne: req.user._id };
  }

  const users = await User.find(filter)
    .sort({ followersCount: -1, _id: -1 })
    .limit(SEARCH_LIMIT)
    .select(MINI_PROFILE_FIELDS);

  return res.json({ status: "success", items: users });
});

// GET /api/users/suggestions
//
// "People to follow" rail rendered on the Explore page when there's no
// active search. Returns the most-followed active accounts, excluding the
// viewer and anyone they already follow so signed-in users keep
// discovering fresh profiles. Private accounts are still surfaced — the
// follow flow handles request-vs-direct-follow downstream.
//
// Public (optionalAuth) so guests can also browse who to follow before
// they sign up; anonymous viewers just see the global top list.
export const getSuggestedUsers = asyncHandler(async (req, res) => {
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, SUGGESTIONS_MAX_LIMIT)
      : SUGGESTIONS_DEFAULT_LIMIT;

  const filter = { isActive: true };

  if (req.user?._id) {
    const excludedIds = [req.user._id];
    if (Array.isArray(req.user.following)) {
      excludedIds.push(...req.user.following);
    }
    filter._id = { $nin: excludedIds };
  }

  const users = await User.find(filter)
    .sort({ followersCount: -1, _id: -1 })
    .limit(limit)
    .select(`${FOLLOW_LIST_FIELDS} followersCount`);

  const items = users.map((doc) => ({
    _id: doc._id,
    username: doc.username,
    name: doc.name,
    avatar: doc.avatar
      ? { url: doc.avatar.url || "", publicId: doc.avatar.publicId || "" }
      : { url: "", publicId: "" },
    bio: doc.bio || "",
    followersCount: doc.followersCount || 0,
    isFollowing: false,
    isSelf: false,
  }));

  return res.json({ status: "success", items });
});

// PATCH /api/users/me
//
// Mass-assignment protected: only the four whitelisted top-level keys are
// read from the body. `role`, `email`, `followers`, `following`, the
// `*Count` denormalised counters, `isActive`, `_id` and timestamps can
// never be set through this endpoint, no matter what the client sends.
//
// `email` change is deliberately out of scope — a real email-change flow
// requires a verification round trip (send code to the new address, confirm,
// then swap) which is its own feature.
//
// Username changes are guarded with a uniqueness pre-check so we can return
// a friendly 409 instead of a generic Mongo duplicate-key error.
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, username, preferences } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  if (typeof name === "string") user.name = name.trim();
  if (typeof bio === "string") user.bio = bio.trim();

  if (typeof username === "string") {
    const next = username.trim().toLowerCase();
    if (next !== user.username) {
      const taken = await User.exists({ username: next, _id: { $ne: user._id } });
      if (taken) {
        return res.status(409).json({
          status: "error",
          message: "Username is already taken.",
        });
      }
      user.username = next;
    }
  }

  // Merge preferences shallowly so the client can update a single nested
  // field (e.g. just `theme`) without having to resend the whole object.
  // Every nested key has already been validated against its enum / boolean
  // shape by `updateProfileRules`, and Mongoose enforces the same rules at
  // save time as a defence-in-depth.
  if (preferences && typeof preferences === "object" && !Array.isArray(preferences)) {
    const current = user.preferences?.toObject?.() ?? {};
    const next = {
      ...current,
      ...preferences,
      privacy: { ...(current.privacy ?? {}), ...(preferences.privacy ?? {}) },
      notifications: {
        ...(current.notifications ?? {}),
        ...(preferences.notifications ?? {}),
      },
    };
    user.preferences = next;
  }

  await user.save();

  return res.json({
    status: "success",
    user: user.toPublicProfile({ viewerId: user._id }),
  });
});

export default {
  getUserByUsername,
  getFollowers,
  getFollowing,
  searchUsers,
  getSuggestedUsers,
  updateProfile,
};
