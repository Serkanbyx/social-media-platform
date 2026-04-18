import { query } from "express-validator";
import mongoose from "mongoose";

// Mirrors the controller clamp so an out-of-range `limit` is rejected up
// front (400) instead of being silently coerced. The cursor is validated as
// a real ObjectId so a hand-crafted query string never reaches Mongo and
// triggers a CastError (which would leak schema details via the stack).
const MAX_PAGE_SIZE = 30;

// Validation rules for `GET /api/notifications`.
//
// Both params are optional — the first page request comes in with no query
// string at all. We validate up-front so an invalid `cursor` or out-of-range
// `limit` fails fast with a clean 400 instead of a confusing Mongo error.
export const listNotificationsRules = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_PAGE_SIZE })
    .withMessage(`Limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`)
    .toInt(),
  query("cursor")
    .optional()
    .custom((value) => mongoose.isValidObjectId(value))
    .withMessage("Cursor must be a valid notification id."),
];

export default { listNotificationsRules };
