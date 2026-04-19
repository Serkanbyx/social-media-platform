import { body, query } from "express-validator";

// Mirror of the User model schema caps. Keeping the literals duplicated here
// is a deliberate trade-off: the validator can fail fast with a 400 before
// the controller ever runs, and Mongoose still has the final word at the
// storage layer if the two ever drift.
const USERNAME_REGEX = /^[a-z0-9_]+$/;
const NAME_MIN = 1;
const NAME_MAX = 60;
const BIO_MAX = 200;
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;

// Search input clamps. 1-character queries match too many users to be useful
// and only widen the regex surface, so we require at least 2. The 30-char
// upper bound matches the username/name maxima with a small safety margin.
const SEARCH_MIN = 2;
const SEARCH_MAX = 30;

// Validation rules for `GET /api/users/search`.
//
// `q` is required — an empty search query has no meaningful result set, so
// we reject it up-front rather than returning every user in the database.
// The controller still escapes the value with `escapeRegex` before passing
// it to Mongo's `$regex`, but trimming + length-clamping here keeps the
// regex compiler from ever seeing pathological input. `escape()` neutralises
// HTML metacharacters as a defence-in-depth so the value is safe to log /
// echo back into admin tooling without further encoding.
export const searchRules = [
  query("q")
    .exists({ checkFalsy: true })
    .withMessage("Search query is required.")
    .bail()
    .isString()
    .withMessage("Search query must be a string.")
    .bail()
    .trim()
    .isLength({ min: SEARCH_MIN, max: SEARCH_MAX })
    .withMessage(`Search query must be between ${SEARCH_MIN} and ${SEARCH_MAX} characters.`)
    .escape(),
];

// Allowed values for nested `preferences.*` fields. Mirrors the User schema
// enums so the validator can reject out-of-range values before the document
// is loaded. Mongoose still enforces these at save time as a safety net.
const ALLOWED_THEMES = ["light", "dark", "system"];
const ALLOWED_LANGUAGES = ["en"];
const ALLOWED_FONT_SIZES = ["sm", "md", "lg"];

// Validation rules for `PATCH /api/users/me`.
//
// Every field is optional — the controller treats a missing key as "leave
// the existing value alone". Mass-assignment of `role`, `email`, `followers`,
// `following`, counters etc. is impossible because the controller destructures
// only the four whitelisted top-level keys (name, bio, username, preferences).
//
// Nested `preferences.*` paths are validated explicitly so a malformed value
// (e.g. `preferences.theme: "neon"`) is rejected with a precise error message
// instead of being silently coerced or surfacing as a generic Mongoose error.
export const updateProfileRules = [
  body("name")
    .optional()
    .isString()
    .withMessage("Name must be a string.")
    .bail()
    .trim()
    .isLength({ min: NAME_MIN, max: NAME_MAX })
    .withMessage(`Name must be between ${NAME_MIN} and ${NAME_MAX} characters.`)
    .escape(),

  body("bio")
    .optional()
    .isString()
    .withMessage("Bio must be a string.")
    .bail()
    .trim()
    .isLength({ max: BIO_MAX })
    .withMessage(`Bio must be at most ${BIO_MAX} characters.`)
    .escape(),

  body("username")
    .optional()
    .isString()
    .withMessage("Username must be a string.")
    .bail()
    .trim()
    .toLowerCase()
    .isLength({ min: USERNAME_MIN, max: USERNAME_MAX })
    .withMessage(`Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters.`)
    .bail()
    .matches(USERNAME_REGEX)
    .withMessage("Username may only contain lowercase letters, digits and underscores."),

  body("preferences")
    .optional()
    .isObject()
    .withMessage("Preferences must be an object."),

  body("preferences.theme")
    .optional()
    .isIn(ALLOWED_THEMES)
    .withMessage(`Theme must be one of: ${ALLOWED_THEMES.join(", ")}.`),

  body("preferences.language")
    .optional()
    .isIn(ALLOWED_LANGUAGES)
    .withMessage(`Language must be one of: ${ALLOWED_LANGUAGES.join(", ")}.`),

  body("preferences.fontSize")
    .optional()
    .isIn(ALLOWED_FONT_SIZES)
    .withMessage(`Font size must be one of: ${ALLOWED_FONT_SIZES.join(", ")}.`),

  body("preferences.reduceMotion")
    .optional()
    .isBoolean()
    .withMessage("reduceMotion must be a boolean.")
    .toBoolean(),

  body("preferences.compactMode")
    .optional()
    .isBoolean()
    .withMessage("compactMode must be a boolean.")
    .toBoolean(),

  body("preferences.privacy")
    .optional()
    .isObject()
    .withMessage("Privacy preferences must be an object."),
  body("preferences.privacy.showEmail")
    .optional()
    .isBoolean()
    .withMessage("showEmail must be a boolean.")
    .toBoolean(),
  body("preferences.privacy.privateAccount")
    .optional()
    .isBoolean()
    .withMessage("privateAccount must be a boolean.")
    .toBoolean(),

  body("preferences.notifications")
    .optional()
    .isObject()
    .withMessage("Notification preferences must be an object."),
  body("preferences.notifications.likes")
    .optional()
    .isBoolean()
    .withMessage("notifications.likes must be a boolean.")
    .toBoolean(),
  body("preferences.notifications.comments")
    .optional()
    .isBoolean()
    .withMessage("notifications.comments must be a boolean.")
    .toBoolean(),
  body("preferences.notifications.follows")
    .optional()
    .isBoolean()
    .withMessage("notifications.follows must be a boolean.")
    .toBoolean(),
];

export default { searchRules, updateProfileRules };
