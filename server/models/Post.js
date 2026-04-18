import mongoose from "mongoose";

import { destroyByPublicId } from "../config/cloudinary.js";

const { Schema, model } = mongoose;

const MAX_CONTENT_LENGTH = 1000;

// Image is a sub-document so the post owns the Cloudinary pointer (url +
// publicId) and we can delete the asset on cascade without joining tables.
const imageSchema = new Schema(
  {
    url: { type: String, default: "", trim: true },
    publicId: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const postSchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Post author is required."],
      index: true,
    },
    // Content is conditionally required: the pre-validate hook below enforces
    // that either `content` or `image.url` must be present, so a single field
    // can't simply be marked `required: true` here.
    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: [
        MAX_CONTENT_LENGTH,
        `Post content must be at most ${MAX_CONTENT_LENGTH} characters.`,
      ],
    },
    image: {
      type: imageSchema,
      default: () => ({ url: "", publicId: "" }),
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Denormalised counters: kept in sync by like / comment controllers so the
    // feed can sort/filter without loading the full `likes` array on every doc.
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    // Admin-only moderation flag. Public read endpoints filter `isHidden:false`
    // so a hidden post is invisible to everyone except admins.
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Feed performance indexes — see STEP 6 / STEP 8 for query shapes.
//   - createdAt desc:                   global recency feeds.
//   - author + createdAt desc:          a single user's profile timeline.
//   - likesCount + createdAt desc:      explore / trending sort.
postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ likesCount: -1, createdAt: -1 });

// Mongoose 9 pre-validate hook — async function with no `next` parameter.
// Either textual content or an uploaded image must be present; an empty post
// has nothing to render and would just be storage noise.
postSchema.pre("validate", async function () {
  const hasContent = typeof this.content === "string" && this.content.trim().length > 0;
  const hasImage = !!this.image?.url;

  if (!hasContent && !hasImage) {
    this.invalidate("content", "Post must have content or an image.");
  }
});

// Cascade-on-delete hook. Bound to the *document* `deleteOne` (not the query
// variant) so `post.deleteOne()` triggers it; bulk `Post.deleteMany(...)` is
// intentionally NOT covered here — bulk paths must run their own cleanup.
//
// We resolve sibling models lazily via `mongoose.model(...)` instead of
// importing them at the top of this file: Comment / Notification both
// reference Post, so a static import would create a circular dependency that
// fails on a cold start where Post.js loads before its siblings.
postSchema.pre("deleteOne", { document: true, query: false }, async function () {
  const postId = this._id;
  const authorId = this.author;
  const imagePublicId = this.image?.publicId;

  // Cloudinary cleanup is best-effort — `destroyByPublicId` already swallows
  // non-fatal errors so a missing remote asset can't block DB cascade.
  if (imagePublicId) {
    await destroyByPublicId(imagePublicId);
  }

  const safeModel = (name) => {
    try {
      return mongoose.model(name);
    } catch {
      // Sibling model not registered yet (e.g. very early boot or an isolated
      // unit test). Skipping is safe: there can be no related docs without
      // the model.
      return null;
    }
  };

  const Comment = safeModel("Comment");
  const Notification = safeModel("Notification");
  const User = safeModel("User");

  await Promise.all([
    Comment ? Comment.deleteMany({ post: postId }) : Promise.resolve(),
    Notification ? Notification.deleteMany({ post: postId }) : Promise.resolve(),
    User && authorId
      ? User.findByIdAndUpdate(authorId, { $inc: { postsCount: -1 } })
      : Promise.resolve(),
  ]);
});

const Post = model("Post", postSchema);

export default Post;
