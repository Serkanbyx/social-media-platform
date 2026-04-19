// Admin bootstrap. Run with: `npm run seed:admin`.
//
// What this does
// --------------
// One thing only: ensure an admin account exists in the database.
//
//   - If a user matching ADMIN_EMAIL or ADMIN_USERNAME already exists,
//     promote it to `role: "admin"`, reactivate it, and reset the
//     password from env (so password rotations propagate on redeploy).
//   - Otherwise, create a fresh admin user.
//
// Why this is split from the demo seed
// ------------------------------------
// This script is INTENTIONALLY tiny:
//   - 1 DB connection, 1-2 queries, ~1 second of work.
//   - No external network calls (no Cloudinary, no DiceBear, no Picsum).
//   - Idempotent and crash-safe — re-running it a hundred times yields
//     the same database state.
//
// That makes it safe to chain into Render's build command:
//
//     npm install && npm run seed:admin
//
// so every deploy guarantees the admin account is present and the
// password matches the current env. The heavier demo seeding lives in
// `seed/demoSeed.js` and is intentionally NOT chained into the build.

import mongoose from "mongoose";

import env from "../config/env.js";
import connectDB from "../config/db.js";
import User from "../models/User.js";

// Mirrors the constraint from the User model's password validator so we
// can fail fast on misconfiguration before reaching Mongo.
const PASSWORD_COMPLEXITY = /^(?=.*[A-Za-z])(?=.*\d).+$/;

const validateEnv = () => {
  const errors = [];

  if (!env.MONGO_URI) errors.push("MONGO_URI is required.");
  if (!env.ADMIN_EMAIL) errors.push("ADMIN_EMAIL is required.");
  if (!env.ADMIN_USERNAME) errors.push("ADMIN_USERNAME is required.");
  if (!env.ADMIN_PASSWORD) errors.push("ADMIN_PASSWORD is required.");
  else if (
    env.ADMIN_PASSWORD.length < 8 ||
    !PASSWORD_COMPLEXITY.test(env.ADMIN_PASSWORD)
  ) {
    errors.push(
      "ADMIN_PASSWORD must be at least 8 characters and contain a letter and a digit."
    );
  }

  return errors;
};

const seedAdmin = async () => {
  const email = env.ADMIN_EMAIL.toLowerCase().trim();
  const username = env.ADMIN_USERNAME.toLowerCase().trim();

  let admin = await User.findOne({ $or: [{ email }, { username }] }).select(
    "+password"
  );

  if (admin) {
    admin.email = email;
    admin.username = username;
    admin.role = "admin";
    admin.isActive = true;
    admin.password = env.ADMIN_PASSWORD;
    if (!admin.name) admin.name = "Administrator";

    await admin.save();
    console.log(`[seed:admin] Promoted existing user → ${admin.email}`);
  } else {
    admin = await User.create({
      username,
      name: "Administrator",
      email,
      password: env.ADMIN_PASSWORD,
      role: "admin",
      isActive: true,
    });
    console.log(`[seed:admin] Created admin → ${admin.email}`);
  }
};

const run = async () => {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    console.error("[seed:admin] Cannot run — invalid configuration:");
    for (const message of envErrors) console.error(`  - ${message}`);
    process.exit(1);
  }

  await connectDB();
  await seedAdmin();
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (error) => {
  console.error("[seed:admin] Failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore — process is exiting anyway
  }
  process.exit(1);
});
