import { Router } from "express";

import {
  register,
  login,
  getMe,
  changePassword,
  deleteAccount,
} from "../controllers/authController.js";

import protect from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import {
  registerRules,
  loginRules,
  changePasswordRules,
  deleteAccountRules,
} from "../validators/authValidator.js";

const router = Router();

router.post("/register", authLimiter, validate(registerRules), register);
router.post("/login", authLimiter, validate(loginRules), login);

router.get("/me", protect, getMe);
router.patch("/change-password", protect, validate(changePasswordRules), changePassword);
router.delete("/delete-account", protect, validate(deleteAccountRules), deleteAccount);

export default router;
