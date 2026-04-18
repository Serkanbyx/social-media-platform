import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/User.js";

// Same idea as `protect`, but never blocks the request. When the token is
// missing, invalid or the user is gone we simply set req.user to null so
// downstream handlers can branch on viewer presence.
const optionalAuth = async (req, _res, next) => {
  req.user = null;

  const header = req.headers.authorization;
  if (typeof header !== "string") return next();

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next();

  try {
    const decoded = jwt.verify(token.trim(), env.JWT_SECRET);
    if (!decoded?.id) return next();

    const user = await User.findById(decoded.id);
    if (user && user.isActive) req.user = user;
  } catch {
    // Silently ignore — caller is treated as anonymous.
  }
  return next();
};

export default optionalAuth;
