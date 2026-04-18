import jwt from "jsonwebtoken";
import env from "../config/env.js";

// Signs a short JWT carrying only the user's id. The receiving middleware
// re-fetches the user on every request so we never trust stale role/state
// information embedded in the token itself.
const generateToken = (userId) =>
  jwt.sign({ id: String(userId) }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

export default generateToken;
