import mongoose from "mongoose";

const { Schema, model } = mongoose;

const MAX_COMMENT_LENGTH = 500;

const commentSchema = new Schema(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Comment must reference a post."],
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Comment author is required."],
      index: true,
    },
    content: {
      type: String,
      required: [true, "Comment content is required."],
      trim: true,
      minlength: [1, "Comment content is required."],
      maxlength: [
        MAX_COMMENT_LENGTH,
        `Comment must be at most ${MAX_COMMENT_LENGTH} characters.`,
      ],
    },
  },
  { timestamps: true }
);

// Compound index supports the only read pattern this model has — a per-post
// timeline sorted newest-first. `_id` works as the sort key because Mongo
// ObjectIds are time-ordered, but `createdAt` is more explicit / future-proof
// if we ever switch to a non-time-ordered id.
commentSchema.index({ post: 1, createdAt: -1 });

// Document-level cascade hook. Bound to `deleteOne` with `document: true` so
// `comment.deleteOne()` triggers it; the query variant `Comment.deleteMany()`
// (used by the Post cascade) intentionally bypasses this hook because the
// post itself is already going away with its counters.
//
// Sibling models (Post, Notification) are resolved lazily via
// `mongoose.model(name)` to avoid a circular import: Post imports cascade
// logic that touches Comment, and a static import here would deadlock the
// module graph during cold start.
commentSchema.pre("deleteOne", { document: true, query: false }, async function () {
  const safeModel = (name) => {
    try {
      return mongoose.model(name);
    } catch {
      // Sibling not registered yet (very early boot / isolated unit test).
      // Skipping is safe: there can be no related docs without the model.
      return null;
    }
  };

  const Post = safeModel("Post");
  const Notification = safeModel("Notification");

  await Promise.all([
    Post
      ? Post.findByIdAndUpdate(this.post, { $inc: { commentsCount: -1 } })
      : Promise.resolve(),
    Notification
      ? Notification.deleteMany({
          type: "comment",
          post: this.post,
          sender: this.author,
        })
      : Promise.resolve(),
  ]);
});

const Comment = model("Comment", commentSchema);

export default Comment;
