import mongoose from "mongoose";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import generateToken from "../utils/generateToken.js";

// Generic responses chosen to prevent user enumeration. Do NOT reveal whether
// the email or the password was the wrong one — the client must not be able
// to use this endpoint to probe for valid accounts.
const INVALID_CREDENTIALS = "Invalid email or password.";
const ACCOUNT_UNAVAILABLE = "Account unavailable.";

// Helper that resolves a registered model by name. Used by deleteAccount to
// cascade across collections that may not exist yet (Post, Comment, etc.
// are introduced in later steps). Returns null when the model isn't loaded.
const tryGetModel = (name) => {
  try {
    return mongoose.model(name);
  } catch {
    return null;
  }
};

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  // Mass-assignment protection: never spread req.body — we accept exactly
  // these four fields. `role`, `isActive`, counters etc. cannot be set here.
  const { username, name, email, password } = req.body;

  // Pre-check both fields in one round trip. We respond with a generic 409
  // that does not leak which field collided (prevents account enumeration).
  const existing = await User.findOne({ $or: [{ email }, { username }] }).lean();
  if (existing) {
    return res.status(409).json({
      status: "error",
      message: "An account with that email or username already exists.",
    });
  }

  const user = await User.create({
    username,
    name,
    email,
    password,
    role: "user",
  });

  const token = generateToken(user._id);

  return res.status(201).json({
    status: "success",
    token,
    user: user.toPublicProfile({ viewerId: user._id }),
  });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");

  // Identical 401 for "no such user" and "wrong password" — anti-enumeration.
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ status: "error", message: INVALID_CREDENTIALS });
  }

  if (!user.isActive) {
    return res.status(403).json({ status: "error", message: ACCOUNT_UNAVAILABLE });
  }

  const token = generateToken(user._id);

  return res.json({
    status: "success",
    token,
    user: user.toPublicProfile({ viewerId: user._id }),
  });
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  return res.json({
    status: "success",
    user: req.user.toPublicProfile({ viewerId: req.user._id }),
  });
});

// PATCH /api/auth/change-password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (currentPassword === newPassword) {
    return res.status(400).json({
      status: "error",
      message: "New password must be different from the current one.",
    });
  }

  // Re-fetch with the password field included (it's `select: false` by default).
  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    return res.status(401).json({ status: "error", message: "Authentication required." });
  }

  const ok = await user.comparePassword(currentPassword);
  if (!ok) {
    return res.status(401).json({ status: "error", message: "Current password is incorrect." });
  }

  user.password = newPassword;
  await user.save();

  return res.json({ status: "success", message: "Password updated successfully." });
});

// DELETE /api/auth/delete-account
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    return res.status(401).json({ status: "error", message: "Authentication required." });
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    return res.status(401).json({ status: "error", message: "Password is incorrect." });
  }

  // Admins must not be able to delete themselves through this endpoint —
  // protects against accidentally locking the platform out of moderation.
  if (user.role === "admin") {
    return res.status(403).json({
      status: "error",
      message: "Admin accounts cannot be deleted through this endpoint.",
    });
  }

  const userId = user._id;

  // Cascade across whichever models are currently registered. The Post,
  // Comment and Notification models are introduced in later steps; until
  // then these branches are simply skipped.
  const Post = tryGetModel("Post");
  const Comment = tryGetModel("Comment");
  const Notification = tryGetModel("Notification");

  if (Post) {
    await Post.updateMany({ likes: userId }, { $pull: { likes: userId } });
    await Post.deleteMany({ author: userId });
  }
  if (Comment) {
    await Comment.deleteMany({ author: userId });
  }
  if (Notification) {
    await Notification.deleteMany({
      $or: [{ recipient: userId }, { sender: userId }],
    });
  }

  // Remove the user from everyone else's followers/following arrays and
  // decrement the denormalised counters in the same operation.
  await User.updateMany(
    { followers: userId },
    { $pull: { followers: userId }, $inc: { followersCount: -1 } }
  );
  await User.updateMany(
    { following: userId },
    { $pull: { following: userId }, $inc: { followingCount: -1 } }
  );

  await user.deleteOne();

  return res.json({ status: "success", message: "Account deleted." });
});
