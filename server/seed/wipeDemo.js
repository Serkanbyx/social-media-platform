// Demo data wipe. Run with: `npm run seed:demo:wipe`.
//
// What this does
// --------------
// Permanently removes the entire demo cohort from the database, including
// any historical demo accounts whose usernames may have been renamed
// across seed-script revisions. After running this, `npm run seed:demo`
// will rebuild everything from scratch with the current `DEMO_USERS` set.
//
// For each demo user found, this performs the same cleanup that the
// admin "delete user" endpoint runs (`cascadeUserDelete` in
// `controllers/adminController.js`) plus a best-effort Cloudinary destroy
// for the user's avatar:
//
//   • posts authored by the user are removed
//   • likes pointing at the user are pulled from every other post
//   • comments authored by the user are removed
//   • notifications sent OR received by the user are removed
//   • the user is pulled out of every other user's followers / following
//     arrays (with counter decrements)
//   • the user's avatar is destroyed on Cloudinary
//   • the user document itself is deleted
//
// Real users are NEVER touched — deletes are filtered by an explicit
// username allow-list (DEMO_USERNAMES below).
//
// Trade-off: post images on Cloudinary owned by the deleted demo posts
// are left orphaned, mirroring the existing `authController.deleteAccount`
// and `cascadeUserDelete` behaviour. They can be cleaned up via the
// Cloudinary dashboard if needed.

import mongoose from "mongoose";

import env from "../config/env.js";
import connectDB from "../config/db.js";
import { destroyByPublicId } from "../config/cloudinary.js";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";

// Authoritative list of every demo username that has ever shipped.
// Keep BOTH the old (Turkish) handles and the current (English) handles
// here so re-runs after a rename always converge on a clean state.
const DEMO_USERNAMES = [
  // Current English cohort (must stay in sync with demoSeed.js).
  "ada_walker",
  "marcus_reed",
  "selin_clark",
  "ben_porter",
  "ella_brooks",
  "ivan_shaw",
  "daphne_oak",
  "evan_polk",
  "zoe_finch",
  "kai_archer",
  // Legacy Turkish cohort (pre-translation).
  "ada_yilmaz",
  "mert_demir",
  "selin_kaya",
  "burak_aydin",
  "ela_celik",
  "can_sahin",
  "defne_aksoy",
  "emir_polat",
  "zeynep_dogan",
  "kerem_arslan",
];

const validateEnv = () => {
  const errors = [];
  if (!env.MONGO_URI) errors.push("MONGO_URI is required.");
  return errors;
};

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

const run = async () => {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    console.error("[seed:demo:wipe] Cannot run — invalid configuration:");
    for (const message of envErrors) console.error(`  - ${message}`);
    process.exit(1);
  }

  const startedAt = Date.now();

  await connectDB();
  console.log("[seed:demo:wipe] Connected to MongoDB");

  const targets = await User.find({
    username: { $in: DEMO_USERNAMES },
  }).select("_id username avatar");

  if (targets.length === 0) {
    console.log("[seed:demo:wipe] No demo users found — nothing to do.");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`[seed:demo:wipe] Found ${targets.length} demo user(s) to remove:`);
  for (const u of targets) console.log(`  • @${u.username}`);

  let removed = 0;
  for (const target of targets) {
    try {
      await cascadeUserDelete(target._id);

      const avatarPublicId = target.avatar?.publicId || "";
      if (avatarPublicId) {
        try {
          await destroyByPublicId(avatarPublicId);
        } catch (error) {
          console.warn(
            `[seed:demo:wipe]   • avatar destroy failed for @${target.username}:`,
            error.message
          );
        }
      }

      await target.deleteOne();
      removed += 1;
    } catch (error) {
      console.warn(
        `[seed:demo:wipe]   • failed to delete @${target.username}:`,
        error.message
      );
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[seed:demo:wipe] Done in ${elapsedSec}s — removed ${removed}/${targets.length} demo users.`
  );
  console.log(
    "[seed:demo:wipe]   • Run `npm run seed:demo` to rebuild the cohort with fresh data."
  );

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (error) => {
  console.error("[seed:demo:wipe] Failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore — process is exiting anyway
  }
  process.exit(1);
});
