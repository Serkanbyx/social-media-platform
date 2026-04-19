// Demo data bootstrap. Run with: `npm run seed:demo`.
//
// What this does
// --------------
// Populates the database with a believable cohort of demo users so the
// public landing page (`/` for guests) renders a non-empty trending grid.
// In order:
//
//   1. Cleanup        — wipes existing demo posts via the document
//                        cascade hook so Cloudinary assets, comments
//                        and notifications are cleaned up too. Also
//                        resets the demo follow graph and counters.
//   2. Users + avatars — upserts the 10 demo accounts and uploads a
//                        fresh DiceBear avatar to Cloudinary for each.
//   3. Follow graph    — every demo user follows 2-4 other demo users
//                        (uses the same `$addToSet` + counter pattern
//                        as the real follow controller).
//   4. Posts           — 3-5 posts per demo user, ~60% with a
//                        Cloudinary-hosted Picsum image, the rest
//                        text-only. `createdAt` is back-dated to land
//                        inside the server's 7-day trending window
//                        (`TRENDING_WINDOW_DAYS` in postController).
//   5. Comments        — 0-5 comments per post, dated AFTER their post
//                        so the timeline stays causal.
//
// One-shot behaviour
// ------------------
// This script is HEAVY (30-60s, dozens of Cloudinary uploads). To make
// it safe to chain into Render's build command, it is **one-shot by
// default**: if all DEMO_USERS are already present in the database, the
// script exits in <1s without doing any work. So:
//
//     npm install && npm run seed:admin && npm run seed:demo
//
// is a fine build command — the first deploy seeds the demo cohort, all
// subsequent deploys are essentially free.
//
// To FORCE a re-seed (e.g. weekly to refresh the trending window or
// because you changed the DEMO_USERS list), pass `--force`:
//
//     npm run seed:demo -- --force
//
// Force mode wipes the existing demo cohort's posts (cascade) and
// rebuilds everything from scratch. Real users are NEVER touched —
// deletes are filtered by `author: { $in: demoUserIds }` and demo users
// are identified by an explicit username allow-list (DEMO_USERS).

import mongoose from "mongoose";

import env from "../config/env.js";
import connectDB from "../config/db.js";
import { uploadBuffer, destroyByPublicId } from "../config/cloudinary.js";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";

// ===========================================================================
// Configuration & static datasets
// ===========================================================================

// Shared password for every demo account. Easy to remember if a recruiter
// ever wants to log in as one of them. Validated by the User schema
// (8+ chars, contains letter and digit).
const DEMO_PASSWORD = "Demo1234!";

// Authoritative list of demo users. The seed only ever touches accounts
// whose `username` is in this array — production / real users are never
// affected by re-runs.
const DEMO_USERS = [
  {
    username: "ada_walker",
    name: "Ada Walker",
    email: "ada.walker@pulse.demo",
    bio: "Demo profile · UI designer, guardian of the morning coffee.",
  },
  {
    username: "marcus_reed",
    name: "Marcus Reed",
    email: "marcus.reed@pulse.demo",
    bio: "Demo profile · Backend engineer, mountain hiker.",
  },
  {
    username: "selin_clark",
    name: "Selin Clark",
    email: "selin.clark@pulse.demo",
    bio: "Demo profile · Product manager, bookworm.",
  },
  {
    username: "ben_porter",
    name: "Ben Porter",
    email: "ben.porter@pulse.demo",
    bio: "Demo profile · Frontend developer, vinyl collector.",
  },
  {
    username: "ella_brooks",
    name: "Ella Brooks",
    email: "ella.brooks@pulse.demo",
    bio: "Demo profile · Illustrator and storyteller.",
  },
  {
    username: "ivan_shaw",
    name: "Ivan Shaw",
    email: "ivan.shaw@pulse.demo",
    bio: "Demo profile · DevOps engineer, photographer.",
  },
  {
    username: "daphne_oak",
    name: "Daphne Oak",
    email: "daphne.oak@pulse.demo",
    bio: "Demo profile · Data scientist, latte art experimenter.",
  },
  {
    username: "evan_polk",
    name: "Evan Polk",
    email: "evan.polk@pulse.demo",
    bio: "Demo profile · Mobile developer, night owl.",
  },
  {
    username: "zoe_finch",
    name: "Zoe Finch",
    email: "zoe.finch@pulse.demo",
    bio: "Demo profile · UX researcher, coffee cup collector.",
  },
  {
    username: "kai_archer",
    name: "Kai Archer",
    email: "kai.archer@pulse.demo",
    bio: "Demo profile · Full-stack developer, runner.",
  },
];

// Post bodies — varied tones (gratitude, question, tip, anecdote, link)
// so the trending grid feels like a real community surface rather than a
// duplicated lorem-ipsum dump.
const POST_TEMPLATES = [
  "Nothing beats the first sip of coffee in the morning. What's your morning ritual?",
  "Started a new habit today: a book instead of my phone for the first half hour after waking up. Let's see how long it lasts.",
  "Small note: teaching a topic is the best way to learn it. What did you teach this week?",
  "A long walk through the city is the best therapy. I'm tired, but my head is much clearer.",
  "Newly discovered podcast: one episode a day, 20 minutes, on the philosophy of life. Highly recommended.",
  "Best cure for the Monday blues: making a list on Sunday evening to clear your head.",
  "Make a mistake, learn from it, share it. A good engineer does that.",
  "Best sentence I read this month: \"Don't rush, but don't pause either.\"",
  "Tried a new recipe: lemony olive-oil artichoke. A bright, easy start in the kitchen.",
  "After a hike I made one decision: less screen and more park time this year.",
  "Avoiding screens after 10 PM really changed my sleep. Give it a shot.",
  "Learning a new language resets the brain. Starting Spanish this week — recommended for anyone curious.",
  "It's raining today, and that's not even an excuse — it's a reason — to read a book.",
  "If you really want to master something, get to the level where you can teach it.",
  "Productivity tools come and go, but a simple paper and pen always wins.",
  "Quick reminder: be kind to yourself. Everyone is dealing with something.",
  "I got up early this morning and saw the shore. Some mornings start before sunrise.",
  "Do you listen to music while coding? For me, lo-fi is non-negotiable.",
  "The excitement of starting a new project is something else. Details soon.",
  "The secret of good design is staying simple. Most of the time it's about removing, not adding.",
  "Learned something today: TypeScript's `satisfies` operator is great. Use it for type safety without thinking twice.",
  "Weekend plan: coffee, book, long walk. Nothing more needed.",
  "The best investment for mental health: 10 minutes of silence every day.",
  "A book recommendation: \"Atomic Habits\". It wouldn't be a lie to say it changed my life.",
  "Sleep early, wake up early. Cliché, but it really works.",
  "Talked with a mentor today and my head is so much clearer. Don't be afraid to ask.",
  "A note: minimum design, minimum code, maximum impact.",
  "I write down 3 small wins each day in a notebook. Works wonders for motivation.",
  "Meeting new coworkers is amazing. Growing with a community is a feeling of its own.",
  "Today I learned: saying \"no\" is also a skill. And a pretty important one.",
];

// Comment bodies — mostly short, conversational, occasionally a question.
const COMMENT_TEMPLATES = [
  "Totally agree!",
  "I need to try this, thanks.",
  "Could you say more?",
  "I was doing the exact same thing this week, weird coincidence.",
  "You put it really well.",
  "Can you tell me which book?",
  "Do you have a resource on this topic?",
  "An inspiring share, thank you.",
  "I read this just in time, really.",
  "I agree. I was thinking the same thing.",
  "A new area for me — would love to read more from you.",
  "Great perspective.",
  "+1 for the coffee part!",
  "Curious about the details.",
  "Such a valuable tip, thanks for sharing.",
  "The same has been happening to me lately.",
  "I'll try it and report back.",
  "Love this approach.",
  "Worked great for me too — give it a try.",
  "Added to my notes.",
];

// --- Tunables --------------------------------------------------------------

const POSTS_PER_USER_MIN = 3;
const POSTS_PER_USER_MAX = 5;

// Probability that a post has an attached image (vs. text-only). Mixing
// the two surfaces both `PostGrid` cell variants — image cells AND the
// gradient text cells — so the landing showcases both.
const POST_IMAGE_PROBABILITY = 0.6;

const COMMENTS_PER_POST_MIN = 0;
const COMMENTS_PER_POST_MAX = 5;

const LIKES_PER_POST_MIN = 3;
const LIKES_PER_POST_MAX = 9; // Capped at demo cohort size; see clamping below.

const FOLLOW_PER_USER_MIN = 2;
const FOLLOW_PER_USER_MAX = 4;

// Sliding window (must stay STRICTLY less than the server's
// TRENDING_WINDOW_DAYS = 7 so newly seeded posts are inside trending).
const POST_AGE_WINDOW_DAYS = 6;

const CLOUDINARY_AVATAR_FOLDER = "social/avatars";
const CLOUDINARY_POST_FOLDER = "social/posts";

// External image sources. DiceBear renders deterministic avatars from a
// seed string; Picsum returns deterministic photos from a seed slug.
const dicebearUrl = (seed) =>
  `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=256`;
const picsumUrl = (seed) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/1080/1080.jpg`;

// ===========================================================================
// Tiny helpers
// ===========================================================================

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const sample = (array) => array[randomInt(0, array.length - 1)];

// Pick `count` distinct items from `pool` (Fisher-Yates partial shuffle).
// Used for likes and follows so we never sample the same id twice.
const sampleMany = (pool, count) => {
  const copy = [...pool];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i += 1) {
    const j = randomInt(i, copy.length - 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};

// Returns a random `Date` within the last `windowDays` days, biased
// toward "now" so the most recent posts feel fresher than 6-day-old ones.
// The bias is a simple square-of-uniform — light enough to not look fake.
const randomRecentDate = (windowDays = POST_AGE_WINDOW_DAYS) => {
  const u = Math.random();
  const biased = u * u; // 0..1, biased toward 0
  const offsetMs = biased * windowDays * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - offsetMs);
};

// Fetch a remote image and return its bytes as a Node Buffer. Uses the
// global `fetch` available in Node 20+. Throws on non-2xx so the caller
// can decide whether to skip or fail.
const downloadImageBuffer = async (url) => {
  const response = await fetch(url, {
    headers: {
      // Some image hosts (Picsum) gate on a UA header.
      "User-Agent": "pulse-seed/1.0 (+https://github.com)",
      Accept: "image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(
      `Image download failed (${response.status} ${response.statusText}) for ${url}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

// Upload a remote image to Cloudinary in one call. Returns null on any
// failure so the caller can degrade gracefully (e.g. fall back to a
// text-only post) instead of aborting the entire seed.
const uploadRemoteToCloudinary = async (url, folder) => {
  try {
    const buffer = await downloadImageBuffer(url);
    const result = await uploadBuffer(buffer, folder);
    return { url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    console.warn(`[seed:demo] image upload failed (${url}):`, error.message);
    return null;
  }
};

// ===========================================================================
// Validation
// ===========================================================================

const validateEnv = () => {
  const errors = [];

  if (!env.MONGO_URI) errors.push("MONGO_URI is required.");
  if (!env.CLOUDINARY_CLOUD_NAME)
    errors.push("CLOUDINARY_CLOUD_NAME is required (avatars + post images).");
  if (!env.CLOUDINARY_API_KEY) errors.push("CLOUDINARY_API_KEY is required.");
  if (!env.CLOUDINARY_API_SECRET)
    errors.push("CLOUDINARY_API_SECRET is required.");

  return errors;
};

// ===========================================================================
// Phase 1 — Cleanup existing demo data
// ===========================================================================

const cleanupExistingDemoData = async (demoUserIds) => {
  console.log("[seed:demo] Phase 1/5 — cleanup");

  if (demoUserIds.length === 0) {
    console.log("[seed:demo]   • nothing to clean (first run)");
    return;
  }

  // Document-level deleteOne so the Post cascade hook fires:
  // - destroys the Cloudinary image asset
  // - deletes related comments and notifications
  // - decrements the author's denormalised postsCount
  // We do this sequentially to avoid racing the same user's postsCount
  // counter from multiple concurrent decrements.
  const postsToDelete = await Post.find({ author: { $in: demoUserIds } });
  for (const post of postsToDelete) {
    try {
      await post.deleteOne();
    } catch (error) {
      console.warn(`[seed:demo]   • failed to delete post ${post._id}:`, error.message);
    }
  }

  // Defensively wipe any orphan comments that somehow outlived their
  // post (shouldn't happen, but cheap insurance against a half-failed
  // previous run).
  await Comment.deleteMany({ author: { $in: demoUserIds } });

  // Reset the demo follow graph entirely. Real users that follow demo
  // accounts are kept (their `following` arrays are not touched) — this
  // only zeroes the demo cohort's own counters, which we rebuild below.
  await User.updateMany(
    { _id: { $in: demoUserIds } },
    {
      $set: {
        following: [],
        followers: [],
        followingCount: 0,
        followersCount: 0,
        postsCount: 0,
      },
    }
  );

  console.log(`[seed:demo]   • removed ${postsToDelete.length} demo posts (cascade)`);
};

// ===========================================================================
// Phase 2 — Demo users + avatars
// ===========================================================================

const upsertDemoUsers = async () => {
  console.log("[seed:demo] Phase 2/5 — users + avatars");

  const results = [];
  for (const seed of DEMO_USERS) {
    const username = seed.username.toLowerCase().trim();
    const email = seed.email.toLowerCase().trim();

    // Find OR create. Find first because we want to preserve _id across
    // re-runs (so any external refs stay valid) and we need the existing
    // avatar publicId to clean up before swapping in the new one.
    let user = await User.findOne({
      $or: [{ username }, { email }],
    }).select("+password");

    if (!user) {
      user = await User.create({
        username,
        name: seed.name,
        email,
        password: DEMO_PASSWORD,
        bio: seed.bio,
        role: "user",
        isActive: true,
      });
    } else {
      user.username = username;
      user.email = email;
      user.name = seed.name;
      user.bio = seed.bio;
      user.role = "user";
      user.isActive = true;
      // Reset password so the demo login path always works even if a
      // previous run with a different password is still in the DB.
      user.password = DEMO_PASSWORD;
      await user.save();
    }

    // Avatar: best-effort upload. If DiceBear or Cloudinary hiccups, we
    // leave the user with no avatar — the `Avatar` component already
    // renders deterministic initials in that case.
    const previousAvatarPublicId = user.avatar?.publicId || "";

    const newAvatar = await uploadRemoteToCloudinary(
      dicebearUrl(username),
      CLOUDINARY_AVATAR_FOLDER
    );

    if (newAvatar) {
      user.avatar = newAvatar;
      await user.save();
      // Best-effort cleanup of the old asset AFTER the new one is
      // persisted, so a Cloudinary destroy failure can never leave the
      // user with a broken avatar pointer.
      if (
        previousAvatarPublicId &&
        previousAvatarPublicId !== newAvatar.publicId
      ) {
        await destroyByPublicId(previousAvatarPublicId);
      }
    }

    results.push(user);
  }

  console.log(`[seed:demo]   • ${results.length} demo users ready (password: ${DEMO_PASSWORD})`);
  return results;
};

// ===========================================================================
// Phase 3 — Follow graph
// ===========================================================================

const buildFollowGraph = async (users) => {
  console.log("[seed:demo] Phase 3/5 — follow graph");

  let edges = 0;
  for (const follower of users) {
    const candidates = users.filter((u) => !u._id.equals(follower._id));
    const targets = sampleMany(
      candidates,
      randomInt(FOLLOW_PER_USER_MIN, FOLLOW_PER_USER_MAX)
    );

    for (const target of targets) {
      // Mirrors followController.toggleFollow: gate on inverse membership
      // so the seed is safely re-runnable without inflating counters.
      const [followerUpdate, targetUpdate] = await Promise.all([
        User.updateOne(
          { _id: follower._id, following: { $ne: target._id } },
          { $addToSet: { following: target._id }, $inc: { followingCount: 1 } }
        ),
        User.updateOne(
          { _id: target._id, followers: { $ne: follower._id } },
          { $addToSet: { followers: follower._id }, $inc: { followersCount: 1 } }
        ),
      ]);
      if (followerUpdate.modifiedCount > 0 && targetUpdate.modifiedCount > 0) {
        edges += 1;
      }
    }
  }

  console.log(`[seed:demo]   • ${edges} new follow edges`);
};

// ===========================================================================
// Phase 4 — Posts (text-only or image, back-dated into trending window)
// ===========================================================================

const createPosts = async (users) => {
  console.log("[seed:demo] Phase 4/5 — posts");

  const allPosts = [];

  // Walk users in a deterministic order; randomness lives in the per-user
  // post count and per-post body / image / likes selection. Keeping the
  // outer order stable makes log lines easier to read on re-runs.
  for (const author of users) {
    const otherUsers = users.filter((u) => !u._id.equals(author._id));
    const postCount = randomInt(POSTS_PER_USER_MIN, POSTS_PER_USER_MAX);

    for (let i = 0; i < postCount; i += 1) {
      const content = sample(POST_TEMPLATES);

      // Image upload only when the dice rolls in our favour. Picsum's
      // `seed` slug includes the username + index so re-runs reuse the
      // same Cloudinary asset family (different publicIds, same images).
      let image = { url: "", publicId: "" };
      if (Math.random() < POST_IMAGE_PROBABILITY) {
        const uploaded = await uploadRemoteToCloudinary(
          picsumUrl(`${author.username}-${i}-${Date.now()}`),
          CLOUDINARY_POST_FOLDER
        );
        if (uploaded) image = uploaded;
      }

      // Pick a like cohort BEFORE creating the doc so we can store
      // `likes` and `likesCount` together in one write.
      const likers = sampleMany(
        otherUsers,
        Math.min(
          randomInt(LIKES_PER_POST_MIN, LIKES_PER_POST_MAX),
          otherUsers.length
        )
      ).map((u) => u._id);

      const createdAt = randomRecentDate();

      // We use `Post.create` directly (not the controller) and then
      // override timestamps so `createdAt` lands inside the trending
      // window. Mongoose otherwise stamps `createdAt = now`.
      let post;
      try {
        post = await Post.create({
          author: author._id,
          content,
          image,
          likes: likers,
          likesCount: likers.length,
          createdAt,
          updatedAt: createdAt,
        });
      } catch (error) {
        console.warn(
          `[seed:demo]   • failed to create post for ${author.username}:`,
          error.message
        );
        continue;
      }

      // Mongoose ignores the explicit `createdAt` on `Post.create`
      // because of `timestamps: true`. Back-date the document with a
      // direct `$set` so the trending window picks it up.
      await Post.updateOne(
        { _id: post._id },
        { $set: { createdAt, updatedAt: createdAt } }
      );

      // Mirror the controller's denormalised counter bump.
      await User.findByIdAndUpdate(author._id, { $inc: { postsCount: 1 } });

      allPosts.push({ ...post.toObject(), createdAt });
    }
  }

  console.log(`[seed:demo]   • ${allPosts.length} posts created`);
  return allPosts;
};

// ===========================================================================
// Phase 5 — Comments (dated AFTER their post, clamped to "now")
// ===========================================================================

const createComments = async (users, posts) => {
  console.log("[seed:demo] Phase 5/5 — comments");

  let count = 0;
  for (const post of posts) {
    const commentCount = randomInt(
      COMMENTS_PER_POST_MIN,
      COMMENTS_PER_POST_MAX
    );
    if (commentCount === 0) continue;

    const candidates = users.filter((u) => !u._id.equals(post.author));
    const commenters = sampleMany(candidates, commentCount);

    for (const commenter of commenters) {
      // Random offset between 1 minute and 2 days AFTER the post, but
      // never in the future. `Math.min` clamps to "now" so a post posted
      // 30 minutes ago doesn't sprout a comment dated 2 days from now.
      const minOffsetMs = 60 * 1000;
      const maxOffsetMs = 2 * 24 * 60 * 60 * 1000;
      const offsetMs = randomInt(minOffsetMs, maxOffsetMs);
      const createdAt = new Date(
        Math.min(post.createdAt.getTime() + offsetMs, Date.now())
      );

      let comment;
      try {
        comment = await Comment.create({
          post: post._id,
          author: commenter._id,
          content: sample(COMMENT_TEMPLATES),
          createdAt,
          updatedAt: createdAt,
        });
      } catch (error) {
        console.warn(
          `[seed:demo]   • failed to create comment by ${commenter.username}:`,
          error.message
        );
        continue;
      }

      await Comment.updateOne(
        { _id: comment._id },
        { $set: { createdAt, updatedAt: createdAt } }
      );

      // Denormalised counter bump — same contract as commentController.
      await Post.updateOne(
        { _id: post._id },
        { $inc: { commentsCount: 1 } }
      );

      count += 1;
    }
  }

  console.log(`[seed:demo]   • ${count} comments created`);
};

// ===========================================================================
// Orchestrator
// ===========================================================================

// Detect `--force` anywhere in argv so build pipelines and humans can
// trigger a full re-seed without editing the script.
const FORCE = process.argv.slice(2).includes("--force");

const run = async () => {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    console.error("[seed:demo] Cannot run — invalid configuration:");
    for (const message of envErrors) console.error(`  - ${message}`);
    process.exit(1);
  }

  const startedAt = Date.now();

  await connectDB();
  console.log("[seed:demo] Connected to MongoDB");

  // Look up existing demo ids — drives both the one-shot guard below
  // and the cleanup phase further down.
  const usernames = DEMO_USERS.map((u) => u.username.toLowerCase());
  const existing = await User.find({ username: { $in: usernames } }).select(
    "_id"
  );
  const existingIds = existing.map((u) => u._id);

  // ONE-SHOT GUARD — skip all heavy work if the demo cohort is already
  // fully present. Lets this script live in `build` without paying the
  // 30-60s cost on every deploy. Pass `--force` to override.
  if (!FORCE && existingIds.length >= DEMO_USERS.length) {
    console.log(
      `[seed:demo] Demo cohort already seeded (${existingIds.length}/${DEMO_USERS.length} users found). Skipping.`
    );
    console.log("[seed:demo]   • Pass `--force` to wipe and re-seed.");
    await mongoose.disconnect();
    process.exit(0);
  }

  await cleanupExistingDemoData(existingIds);
  const users = await upsertDemoUsers();
  await buildFollowGraph(users);
  const posts = await createPosts(users);
  await createComments(users, posts);

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[seed:demo] ✓ Done in ${elapsedSec}s`);
  console.log(`[seed:demo]   • Demo login: any of the demo emails + password "${DEMO_PASSWORD}"`);
  console.log(
    `[seed:demo]   • To refresh the ${POST_AGE_WINDOW_DAYS}-day trending window later, run: npm run seed:demo -- --force`
  );

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (error) => {
  console.error("[seed:demo] Failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore — process is exiting anyway
  }
  process.exit(1);
});
