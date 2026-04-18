// Idempotent admin bootstrap script. Run with: `npm run seed:admin`.
// Reads ADMIN_EMAIL / ADMIN_USERNAME / ADMIN_PASSWORD from server/.env
// and either creates a brand new admin account or promotes the existing
// one to role=admin and resets its password / activation flag.

import mongoose from "mongoose";
import env from "../config/env.js";
import connectDB from "../config/db.js";
import User from "../models/User.js";

const PASSWORD_COMPLEXITY = /^(?=.*[A-Za-z])(?=.*\d).+$/;

const validateEnv = () => {
  const errors = [];
  if (!env.ADMIN_EMAIL) errors.push("ADMIN_EMAIL is required.");
  if (!env.ADMIN_USERNAME) errors.push("ADMIN_USERNAME is required.");
  if (!env.ADMIN_PASSWORD) errors.push("ADMIN_PASSWORD is required.");
  else if (env.ADMIN_PASSWORD.length < 8 || !PASSWORD_COMPLEXITY.test(env.ADMIN_PASSWORD)) {
    errors.push("ADMIN_PASSWORD must be at least 8 characters and contain a letter and a digit.");
  }
  return errors;
};

const seedAdmin = async () => {
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    console.error("[seed:admin] Cannot run — invalid configuration:");
    for (const message of envErrors) console.error(`  - ${message}`);
    process.exit(1);
  }

  await connectDB();

  const email = env.ADMIN_EMAIL.toLowerCase().trim();
  const username = env.ADMIN_USERNAME.toLowerCase().trim();

  let admin = await User.findOne({ $or: [{ email }, { username }] }).select("+password");

  if (admin) {
    admin.email = email;
    admin.username = username;
    admin.role = "admin";
    admin.isActive = true;
    admin.password = env.ADMIN_PASSWORD;
    if (!admin.name) admin.name = "Administrator";

    await admin.save();
    console.log(`[seed:admin] Existing user promoted to admin: ${admin.email}`);
  } else {
    admin = await User.create({
      username,
      name: "Administrator",
      email,
      password: env.ADMIN_PASSWORD,
      role: "admin",
      isActive: true,
    });
    console.log(`[seed:admin] Admin account created: ${admin.email}`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

seedAdmin().catch(async (error) => {
  console.error("[seed:admin] Failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore — process is exiting anyway
  }
  process.exit(1);
});
