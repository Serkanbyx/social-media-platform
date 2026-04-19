import env from "../config/env.js";

// 404 handler — placed right before the global error handler in index.js.
export const notFoundHandler = (req, res, _next) => {
  res.status(404).json({
    status: "error",
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// Builds a normalised { status, message, errors? } payload for known error
// shapes. Keeps the global handler small and focused on the response.
const buildKnownError = (err) => {
  // Mongoose schema validation — return the first message per field.
  if (err?.name === "ValidationError") {
    const errors = {};
    for (const [field, detail] of Object.entries(err.errors || {})) {
      errors[field] = detail?.message || "Invalid value.";
    }
    const firstMessage = Object.values(errors)[0] || "Validation failed.";
    return { statusCode: 400, message: firstMessage, errors };
  }

  // Bad ObjectId / cast failure — usually a malformed URL parameter.
  if (err?.name === "CastError") {
    return { statusCode: 400, message: "Invalid ID." };
  }

  // Mongo duplicate key (unique index violation). We deliberately do NOT
  // leak which field collided in production — it would enable account
  // enumeration on `email` or `username`.
  if (err?.code === 11000) {
    if (env.isProduction) {
      return { statusCode: 409, message: "Resource already exists." };
    }
    const field = Object.keys(err.keyValue || {})[0];
    return {
      statusCode: 409,
      message: field ? `Resource already exists (duplicate ${field}).` : "Resource already exists.",
    };
  }

  // JWT errors are mapped to 401 so the client can transparently log out.
  if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
    return { statusCode: 401, message: "Authentication required." };
  }

  return null;
};

// Global error handler. Must be the LAST middleware mounted on the app.
// Express 5 forwards async rejections here automatically when controllers
// either `throw` or are wrapped with `asyncHandler`.
export const errorHandler = (err, req, res, _next) => {
  const known = buildKnownError(err);

  const statusCode =
    known?.statusCode ??
    (Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500);

  const payload = {
    status: "error",
    message: known?.message || err?.message || "Server error.",
  };

  if (known?.errors) payload.errors = known.errors;
  else if (err?.errors && typeof err.errors === "object") payload.errors = err.errors;

  // In production we hide stack traces and replace 500-level messages with a
  // generic string so we don't leak internal details to clients.
  if (env.isProduction) {
    if (statusCode >= 500) payload.message = "Server error.";
  } else {
    payload.stack = err?.stack;
  }

  if (statusCode >= 500 && !env.isProduction) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  res.status(statusCode).json(payload);
};

export default errorHandler;
