import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/User.js";

// Socket.io handshake authentication.
//
// The client must send a JWT through `socket.handshake.auth.token` (the
// `auth` payload is the only handshake field that is encrypted under TLS in
// transit and never logged by reverse proxies — query strings can leak via
// access logs, so we explicitly avoid them).
//
// On success: attaches a lean User document to `socket.user` and calls next().
// On any failure (missing token, invalid signature, expired, deleted user,
// deactivated user) we reject with a generic "Unauthorized" error to avoid
// leaking which check failed.
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake?.auth?.token;
    if (typeof token !== "string" || token.trim().length === 0) {
      return next(new Error("Unauthorized"));
    }

    const decoded = jwt.verify(token.trim(), env.JWT_SECRET);
    if (!decoded?.id) return next(new Error("Unauthorized"));

    const user = await User.findById(decoded.id).select("-password").lean();
    if (!user || user.isActive === false) {
      return next(new Error("Unauthorized"));
    }

    socket.user = user;
    return next();
  } catch {
    return next(new Error("Unauthorized"));
  }
};

export default socketAuth;
