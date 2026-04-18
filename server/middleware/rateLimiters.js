import { rateLimit } from "express-rate-limit";

// express-rate-limit v8: use `limit` (not the legacy `max`) and emit the
// IETF draft-8 `RateLimit` + `RateLimit-Policy` headers. Legacy X-RateLimit-* off.
const buildLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { status: "error", message },
  });

export const globalLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: "Too many requests. Please try again in a few minutes.",
});

export const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many authentication attempts. Please wait 15 minutes.",
});

export const writeLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  message: "You are doing that too often. Slow down for a minute.",
});

export const adminLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: "Admin rate limit exceeded. Please wait a few minutes.",
});
