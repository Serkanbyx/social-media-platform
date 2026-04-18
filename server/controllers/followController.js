import mongoose from "mongoose";

import User from "../models/User.js";
import { createAndEmit } from "../services/notificationService.js";
import asyncHandler from "../utils/asyncHandler.js";

// POST /api/users/:id/follow
// Idempotent follow / unfollow toggle. A single endpoint shape keeps the
// client logic dead simple (one button, one call) and removes a whole
// class of race bugs that separate /follow + /unfollow routes produce
// when they fire out of order.
//
// Concurrency safety — the same playbook as `likeController.toggleLike`:
//   - The viewer's current state is detected from the already-loaded
//     `req.user.following` array (no extra round-trip).
//   - Each side of the relationship is mutated with a conditional
//     `updateOne` filtered on the array membership, so two concurrent
//     toggles can never both increment / decrement the same counter.
//   - `$addToSet` and `$pull` make the array updates set-like, so even
//     under burst duplicate POSTs the arrays cannot grow past one entry.
//   - Both sides run in parallel via `Promise.all` — they touch different
//     documents so there is no contention.
//   - After the writes settle we re-read the target's `followersCount`
//     so the response always reflects the persisted truth, not a value
//     we computed locally and could have skewed under a concurrent toggle.
//
// 404 is intentionally returned for both invalid ObjectIds and inactive
// or missing target users so a probe can't tell deactivated accounts
// from genuinely deleted ones (anti-enumeration).
export const toggleFollow = asyncHandler(async (req, res) => {
  const { id: targetId } = req.params;
  const myId = req.user._id;

  if (!mongoose.isValidObjectId(targetId)) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  if (String(targetId) === String(myId)) {
    return res
      .status(400)
      .json({ status: "error", message: "You cannot follow yourself." });
  }

  const target = await User.findOne({ _id: targetId, isActive: true }).select("_id");

  if (!target) {
    return res.status(404).json({ status: "error", message: "User not found." });
  }

  const alreadyFollowing =
    Array.isArray(req.user.following) &&
    req.user.following.some((followedId) => String(followedId) === String(targetId));

  if (alreadyFollowing) {
    // Unfollow — each side is gated on its membership filter so a
    // duplicate request that already unfollowed finds zero documents and
    // no-ops instead of double-decrementing the denormalised counters.
    await Promise.all([
      User.updateOne(
        { _id: myId, following: targetId },
        { $pull: { following: targetId }, $inc: { followingCount: -1 } }
      ),
      User.updateOne(
        { _id: targetId, followers: myId },
        { $pull: { followers: myId }, $inc: { followersCount: -1 } }
      ),
    ]);

    const fresh = await User.findById(targetId).select("followersCount");

    return res.json({
      status: "success",
      following: false,
      followersCount: fresh?.followersCount ?? 0,
    });
  }

  // Follow — each side is gated on the inverse membership filter so a
  // concurrent duplicate POST cannot inflate the counter past the array
  // length. `$addToSet` is also idempotent at the array level as a
  // defence-in-depth.
  await Promise.all([
    User.updateOne(
      { _id: myId, following: { $ne: targetId } },
      { $addToSet: { following: targetId }, $inc: { followingCount: 1 } }
    ),
    User.updateOne(
      { _id: targetId, followers: { $ne: myId } },
      { $addToSet: { followers: myId }, $inc: { followersCount: 1 } }
    ),
  ]);

  // Fire the notification AFTER both sides of the relationship are
  // persisted so we never notify on a follow that didn't take effect.
  // Self-follow is already rejected up top, so no extra guard is needed
  // at the call site (the service has its own defence-in-depth check).
  // Wrapped so a notification failure cannot turn a successful follow
  // into a 500.
  try {
    await createAndEmit({
      recipient: targetId,
      sender: myId,
      type: "follow",
    });
  } catch (err) {
    console.error("[notification] failed to emit follow notification:", err);
  }

  const fresh = await User.findById(targetId).select("followersCount");

  return res.json({
    status: "success",
    following: true,
    followersCount: fresh?.followersCount ?? 0,
  });
});

export default { toggleFollow };
