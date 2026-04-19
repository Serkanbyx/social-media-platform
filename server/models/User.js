import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema, model } = mongoose;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]+$/;
const PASSWORD_COMPLEXITY = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const BCRYPT_SALT_ROUNDS = 12;

const avatarSchema = new Schema(
  {
    url: { type: String, default: "", trim: true },
    publicId: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const preferencesSchema = new Schema(
  {
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    language: {
      type: String,
      enum: ["en"],
      default: "en",
    },
    fontSize: {
      type: String,
      enum: ["sm", "md", "lg"],
      default: "md",
    },
    reduceMotion: { type: Boolean, default: false },
    compactMode: { type: Boolean, default: false },
    privacy: {
      showEmail: { type: Boolean, default: false },
      privateAccount: { type: Boolean, default: false },
    },
    notifications: {
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
    },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required."],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters."],
      maxlength: [20, "Username must be at most 20 characters."],
      match: [USERNAME_REGEX, "Username may only contain lowercase letters, digits and underscores."],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: [1, "Name is required."],
      maxlength: [60, "Name must be at most 60 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, "A valid email address is required."],
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password must be at least 8 characters."],
      maxlength: [128, "Password must be at most 128 characters."],
      validate: {
        // Skip the complexity check for already-hashed values (bcrypt hashes are 60 chars,
        // start with `$2`). The check only matters when a plaintext password is being set.
        validator(value) {
          if (typeof value !== "string") return false;
          if (value.startsWith("$2")) return true;
          return PASSWORD_COMPLEXITY.test(value);
        },
        message: "Password must contain at least one letter and one number.",
      },
      select: false,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: [200, "Bio must be at most 200 characters."],
    },
    avatar: {
      type: avatarSchema,
      default: () => ({ url: "", publicId: "" }),
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      required: true,
    },
    following: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
    followers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    postsCount: { type: Number, default: 0, min: 0 },
    preferences: {
      type: preferencesSchema,
      default: () => ({}),
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ createdAt: -1 });

// Mongoose 9 pre-save hook — async function with no `next` parameter.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.password) return false;
  return bcrypt.compare(plain, this.password);
};

// Returns a sanitised view of the user document. The viewer's id determines
// whether private fields (email, preferences) are exposed. The owner can
// always see everything; other users only see `email` if showEmail is on.
userSchema.methods.toPublicProfile = function toPublicProfile({ viewerId } = {}) {
  const isOwner = viewerId && String(viewerId) === String(this._id);
  const showEmail = isOwner || this.preferences?.privacy?.showEmail === true;

  const profile = {
    _id: this._id,
    username: this.username,
    name: this.name,
    bio: this.bio,
    avatar: this.avatar
      ? { url: this.avatar.url || "", publicId: this.avatar.publicId || "" }
      : { url: "", publicId: "" },
    role: this.role,
    followersCount: this.followersCount,
    followingCount: this.followingCount,
    postsCount: this.postsCount,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };

  if (showEmail) profile.email = this.email;
  if (isOwner) profile.preferences = this.preferences;

  return profile;
};

const User = model("User", userSchema);

export default User;
