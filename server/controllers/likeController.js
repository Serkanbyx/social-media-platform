import mongoose from "mongoose";

import Post from "../models/Post.js";
import asyncHandler from "../utils/asyncHandler.js";

// POST /api/posts/:id/like
// Idempotent like / unlike toggle. The single endpoint shape keeps the
// client logic dead simple (one button, one call) and removes a whole
// class of double-tap race bugs that separate /like + /unlike routes
// produce when they fire out of order.
//
// Concurrency safety:
//   - `$addToSet` makes the like array set-like, so a burst of duplicate
//     POSTs from the same user can never grow `likes` past one entry.
//   - The current state is detected with `findOne` and then mutated with
//     a single `updateOne` filtered on `{ _id, likes: <op-specific> }`,
//     so two concurrent toggles cannot both increment / decrement the
//     `likesCount` denormalised counter.
//   - When the conditional update matches zero documents we re-read the
//     post and report whatever the persisted state is, so the client
//     stays in sync even if a sibling tab beat us to the toggle.
//
// 404 is intentionally returned for missing OR hidden posts so a probe
// can't tell admin-hidden content from genuinely deleted content.
export const toggleLike = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const viewerId = req.user._id;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  const post = await Post.findOne({ _id: id, isHidden: false }).select("author likes likesCount");

  if (!post) {
    return res.status(404).json({ status: "error", message: "Post not found." });
  }

  const viewerKey = String(viewerId);
  const alreadyLiked = post.likes.some((likeId) => String(likeId) === viewerKey);

  if (alreadyLiked) {
    // Unlike — gated on `likes: viewerId` so a duplicate request from a
    // tab that already unliked finds zero documents and no-ops instead
    // of double-decrementing the counter.
    const result = await Post.updateOne(
      { _id: post._id, likes: viewerId },
      { $pull: { likes: viewerId }, $inc: { likesCount: -1 } }
    );

    if (result.modifiedCount === 0) {
      const fresh = await Post.findById(post._id).select("likesCount");
      return res.json({
        status: "success",
        liked: false,
        likesCount: fresh?.likesCount ?? 0,
      });
    }

    return res.json({
      status: "success",
      liked: false,
      likesCount: Math.max(0, post.likesCount - 1),
    });
  }

  // Like — gated on `likes: { $ne: viewerId }` so a concurrent duplicate
  // POST cannot inflate the counter past the array length. `$addToSet`
  // is also idempotent at the array level as a defence-in-depth.
  const result = await Post.updateOne(
    { _id: post._id, likes: { $ne: viewerId } },
    { $addToSet: { likes: viewerId }, $inc: { likesCount: 1 } }
  );

  if (result.modifiedCount === 0) {
    const fresh = await Post.findById(post._id).select("likesCount");
    return res.json({
      status: "success",
      liked: true,
      likesCount: fresh?.likesCount ?? post.likesCount,
    });
  }

  // Notification trigger lives in STEP 17 — the emission service will be
  // wired in here and is intentionally skipped on self-likes so users do
  // not get a buzz from their own button-tap.
  // if (String(post.author) !== viewerKey) {
  //   await emitLikeNotification({ post, actor: req.user });
  // }

  return res.json({
    status: "success",
    liked: true,
    likesCount: post.likesCount + 1,
  });
});

export default { toggleLike };
