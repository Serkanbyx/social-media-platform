import { body } from "express-validator";

// Username: lowercase letters, digits and underscore only — same shape as the
// User model schema. We do NOT escape() it because the regex already restricts
// the allowed characters to a safe set.
const usernameRule = () =>
  body("username")
    .exists({ checkFalsy: true })
    .withMessage("Username is required.")
    .bail()
    .isString()
    .withMessage("Username must be a string.")
    .bail()
    .trim()
    .toLowerCase()
    .isLength({ min: 3, max: 20 })
    .withMessage("Username must be between 3 and 20 characters.")
    .bail()
    .matches(/^[a-z0-9_]+$/)
    .withMessage("Username may only contain lowercase letters, digits and underscores.");

const nameRule = () =>
  body("name")
    .exists({ checkFalsy: true })
    .withMessage("Name is required.")
    .bail()
    .isString()
    .withMessage("Name must be a string.")
    .bail()
    .trim()
    .isLength({ min: 1, max: 60 })
    .withMessage("Name must be between 1 and 60 characters.")
    .escape();

const emailRule = () =>
  body("email")
    .exists({ checkFalsy: true })
    .withMessage("Email is required.")
    .bail()
    .isEmail()
    .withMessage("A valid email address is required.")
    .bail()
    .normalizeEmail();

// Password complexity: at least one letter and one digit. Symbols are
// allowed but not required, mirroring the User model schema validator.
const PASSWORD_COMPLEXITY = /^(?=.*[A-Za-z])(?=.*\d).+$/;

const passwordRule = (field = "password") =>
  body(field)
    .exists({ checkFalsy: true })
    .withMessage("Password is required.")
    .bail()
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters.")
    .bail()
    .matches(PASSWORD_COMPLEXITY)
    .withMessage("Password must contain at least one letter and one number.");

export const registerRules = [usernameRule(), nameRule(), emailRule(), passwordRule("password")];

export const loginRules = [
  body("email")
    .exists({ checkFalsy: true })
    .withMessage("Email is required.")
    .bail()
    .isEmail()
    .withMessage("A valid email address is required.")
    .normalizeEmail(),
  body("password").exists({ checkFalsy: true }).withMessage("Password is required."),
];

export const changePasswordRules = [
  body("currentPassword").exists({ checkFalsy: true }).withMessage("Current password is required."),
  passwordRule("newPassword"),
];

export const deleteAccountRules = [
  body("password").exists({ checkFalsy: true }).withMessage("Password confirmation is required."),
];
