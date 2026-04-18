import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getIo } from "../socket/index.js";

// Public projections for the populated payload — must match what the
// notification list endpoint returns so the client can merge a real-time
// item straight into the same store without re-fetching.
const SENDER_PUBLIC_FIELDS = "username name avatar";
const POST_PREVIEW_FIELDS = "content image";

// Map a notification type to the matching opt-out flag in the recipient's
// preferences. A future type only needs an entry here + the model enum.
const PREFERENCE_FLAG_BY_TYPE = {
  like: "likes",
  comment: "comments",
  follow: "follows",
};

// Resolve the Socket.IO instance defensively — `getIo()` throws when the
// server hasn't been initialised yet (e.g. during a unit test or a script).
// Returning null lets the caller silently skip the emit instead of crashing
// the parent request.
const safeGetIo = () => {
  try {
    return getIo();
  } catch {
    return null;
  }
};

// Emit to the recipient's private room. Centralised so every emit goes
// through the same `safeGetIo` guard and the room naming stays in one place.
const emitToRecipient = (recipient, event, payload) => {
  const io = safeGetIo();
  if (!io) return;
  io.to(`user:${recipient}`).emit(event, payload);
};

// Persist a notification and push it to the recipient over Socket.IO.
//
// Design notes:
//   - Self-notifications are blocked at the very top so we never spend a DB
//     round-trip on them. The model also has a `pre("validate")` safety net.
//   - The recipient's per-type opt-out is honoured before we persist OR emit,
//     so a "muted" notification leaves zero footprint (no row, no socket
//     event, no unread-count bump).
//   - The created document is re-read with `.populate(...).lean()` so the
//     Socket.IO payload matches the shape the REST list endpoint returns;
//     the client can drop a real-time item into the same store without a
//     refetch.
//   - The unread-count badge is emitted as a separate, lightweight event so
//     a client that only cares about the badge (e.g. the nav bar) can ignore
//     the heavier `notification:new` payload entirely.
//   - Returns `null` for every "skipped" branch (self / missing recipient /
//     muted) so callers can branch on truthy without try/catching.
export const createAndEmit = async ({ recipient, sender, type, post = null }) => {
  if (!recipient || !sender || !type) return null;
  if (String(recipient) === String(sender)) return null;

  const recipientUser = await User.findById(recipient)
    .select("preferences.notifications")
    .lean();
  if (!recipientUser) return null;

  const prefs = recipientUser.preferences?.notifications || {};
  const flag = PREFERENCE_FLAG_BY_TYPE[type];
  if (flag && prefs[flag] === false) return null;

  const doc = await Notification.create({ recipient, sender, type, post });

  const populated = await Notification.findById(doc._id)
    .populate("sender", SENDER_PUBLIC_FIELDS)
    .populate("post", POST_PREVIEW_FIELDS)
    .lean();

  emitToRecipient(recipient, "notification:new", populated);

  // Lightweight badge update — kept as a separate event so a subscriber that
  // only renders the unread count doesn't have to parse the full payload.
  const unreadCount = await Notification.countDocuments({
    recipient,
    isRead: false,
  });
  emitToRecipient(recipient, "notification:unread-count", { count: unreadCount });

  return populated;
};

export default { createAndEmit };
