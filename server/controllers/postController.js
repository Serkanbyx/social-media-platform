import Post from "../models/Post.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadBuffer, destroyByPublicId } from "../config/cloudinary.js";

// Cloudinary folder is namespaced per asset class so post-image cleanup
// can never accidentally touch avatars (or vice versa) and we can apply
// per-folder transformation presets later without changing controller code.
const POST_IMAGE_FOLDER = "social/posts";

// Public author projection — never leak email, password, preferences, etc.
const AUTHOR_PUBLIC_FIELDS = "username name avatar";

// POST /api/posts
// Mass-assignment protected: only `content` is read from the body. The author
// is always taken from the authenticated session and counters / moderation
// flags can never be set by the client.
export const createPost = asyncHandler(async (req, res) => {
  const { content } = req.body;

  const draft = {
    author: req.user._id,
    content: typeof content === "string" ? content.trim() : "",
  };

  // Stream the in-memory buffer to Cloudinary BEFORE we hit the DB so we know
  // the asset URL up-front. We keep a handle to the upload result so a later
  // DB failure can roll the orphan asset back.
  let uploaded = null;
  if (req.file?.buffer) {
    uploaded = await uploadBuffer(req.file.buffer, POST_IMAGE_FOLDER);
    draft.image = {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    };
  }

  let post;
  try {
    post = await Post.create(draft);
  } catch (error) {
    // Roll back the orphan Cloudinary asset so a failed insert (validation
    // error, transient connection drop, etc.) doesn't leave the bucket with
    // a file that no Post document ever referenced.
    if (uploaded?.public_id) {
      await destroyByPublicId(uploaded.public_id);
    }
    throw error;
  }

  // Denormalised counter — kept in sync here so profile pages can render the
  // post count without aggregating the Post collection on every request.
  // Done after Post.create so a failed insert doesn't bump the counter.
  await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });

  await post.populate("author", AUTHOR_PUBLIC_FIELDS);

  return res.status(201).json({
    status: "success",
    post,
  });
});

export default { createPost };
