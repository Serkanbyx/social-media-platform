import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/User.js";

const UNAUTHORIZED = { status: "error", message: "Authentication required." };

// Pulls "Bearer <token>" out of the Authorization header. Returns null when
// the header is missing/malformed so the caller can decide how strict to be.
const extractBearerToken = (header) => {
  if (typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token.trim() || null;
};

// Strict authentication: any failure (missing header, bad signature, expired,
// missing user, deactivated user) results in 401. Attaches the full user
// document (without password) to req.user.
export const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json(UNAUTHORIZED);

    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json(UNAUTHORIZED);

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json(UNAUTHORIZED);

    req.user = user;
    return next();
  } catch {
    return res.status(401).json(UNAUTHORIZED);
  }
};

export default protect;
