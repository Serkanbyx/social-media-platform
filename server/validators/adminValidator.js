import { body, query } from "express-validator";

// Mirrors the admin controller's pagination clamp. Keeping the literal in
// both files is the deliberate trade-off: the validator can fail fast with
// a clean 400 before the controller ever runs, and the controller still
// re-clamps as a defence-in-depth.
const MAX_PAGE_SIZE = 100;

// Mirrors the User schema enum. Adding a new role (e.g. "moderator") only
// requires updating this list and the schema; the controller treats every
// allowed value uniformly.
const ALLOWED_ROLES = ["user", "admin"];

// Search input clamps. The same 30-char ceiling used by the public user
// search is reused here — admins do not need a wider search surface and a
// generous cap would only widen the regex attack surface if an admin token
// were ever stolen.
const SEARCH_MAX = 30;

// Validation rules for `GET /api/admin/users`.
//
// Every parameter is optional — an admin landing on the user table with
// no filters should see the full list. We validate the shape of each
// filter explicitly so a malformed value (e.g. `?isActive=please`) is
// rejected with a precise 400 instead of being silently coerced into a
// surprising query.
export const listUsersRules = [
  query("q")
    .optional()
    .isString()
    .withMessage("Search query must be a string.")
    .bail()
    .trim()
    .isLength({ max: SEARCH_MAX })
    .withMessage(`Search query must be at most ${SEARCH_MAX} characters.`),
  query("role")
    .optional()
    .isIn(ALLOWED_ROLES)
    .withMessage(`Role must be one of: ${ALLOWED_ROLES.join(", ")}.`),
  query("isActive")
    .optional()
    .isIn(["true", "false"])
    .withMessage("isActive must be either 'true' or 'false'."),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer.")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_PAGE_SIZE })
    .withMessage(`Limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`)
    .toInt(),
];

// Validation rules for `PATCH /api/admin/users/:id/role`.
//
// `role` is required and must be one of the schema enum values. The
// self-protection and last-admin protection live in the controller
// because they need access to `req.user` and a DB count respectively.
export const updateUserRoleRules = [
  body("role")
    .exists({ checkNull: true })
    .withMessage("Role is required.")
    .bail()
    .isIn(ALLOWED_ROLES)
    .withMessage(`Role must be one of: ${ALLOWED_ROLES.join(", ")}.`),
];

// Validation rules for `PATCH /api/admin/users/:id/active`.
//
// `isActive` must be a strict boolean — we accept the JSON literal `true`
// or `false` only. Coercing strings here would be convenient but would
// also let a typo (`isActive: "no"`) silently disable an account.
export const setUserActiveRules = [
  body("isActive")
    .exists({ checkNull: true })
    .withMessage("isActive is required.")
    .bail()
    .isBoolean({ strict: true })
    .withMessage("isActive must be a boolean."),
];

// Validation rules shared by `GET /api/admin/posts` and
// `GET /api/admin/comments`. Both endpoints are page-based with the same
// pagination clamp; the post listing additionally accepts the optional
// `?isHidden=true|false` filter.
export const listPostsRules = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer.")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_PAGE_SIZE })
    .withMessage(`Limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`)
    .toInt(),
  query("isHidden")
    .optional()
    .isIn(["true", "false"])
    .withMessage("isHidden must be either 'true' or 'false'."),
];

export const listCommentsRules = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer.")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: MAX_PAGE_SIZE })
    .withMessage(`Limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`)
    .toInt(),
];

export default {
  listUsersRules,
  updateUserRoleRules,
  setUserActiveRules,
  listPostsRules,
  listCommentsRules,
};
