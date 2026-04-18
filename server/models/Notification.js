import mongoose from "mongoose";

const { Schema, model } = mongoose;

// Single source of truth for the supported notification types. Used by both
// the schema enum and the conditional `post` validator below; a future type
// (`mention`, `reply`, …) only needs to be added in one place.
const NOTIFICATION_TYPES = ["like", "comment", "follow"];

// Types that target a specific post — the `post` field is required for
// these and intentionally omitted (null) for `follow`. Using a Set keeps
// the validator O(1) and the intent self-documenting.
const POST_REQUIRED_TYPES = new Set(["like", "comment"]);

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Notification recipient is required."],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Notification sender is required."],
    },
    type: {
      type: String,
      required: [true, "Notification type is required."],
      enum: {
        values: NOTIFICATION_TYPES,
        message: "Notification type must be one of: like, comment, follow.",
      },
    },
    // Conditional ref: required when the type targets a post (like/comment),
    // null for `follow`. Enforced at the storage layer so the invariant
    // can't be bypassed by writing through the model directly.
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      validate: {
        validator(value) {
          if (POST_REQUIRED_TYPES.has(this.type)) {
            return value != null;
          }
          return true;
        },
        message: "Notification post is required for like and comment types.",
      },
    },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Index playbook (matches the read patterns in `notificationController.js`):
//   - createdAt desc:                               global recency / debug.
//   - recipient + isRead + createdAt desc:          covers both the unread
//                                                   badge query AND the
//                                                   per-recipient list page,
//                                                   so the unread-count is
//                                                   O(log n) and pagination
//                                                   is an index-only seek.
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// Anti-self-notification safety net. The emission service in STEP 17 already
// guards against self-notifies, but enforcing it at the storage layer means
// a future code path (admin tool, seed script, etc.) cannot create one by
// accident either.
notificationSchema.pre("validate", function () {
  if (this.recipient && this.sender && this.recipient.equals(this.sender)) {
    this.invalidate("sender", "A notification cannot be sent to its own recipient.");
  }
});

const Notification = model("Notification", notificationSchema);

export default Notification;
