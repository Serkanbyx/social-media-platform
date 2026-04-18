import env from "../config/env.js";

// 404 handler — placed right before the global error handler in index.js.
export const notFoundHandler = (req, res, _next) => {
  res.status(404).json({
    status: "error",
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// Global error handler. Must be the LAST middleware mounted on the app.
// Express 5 forwards async rejections here automatically when controllers
// either `throw` or are wrapped with `asyncHandler`.
export const errorHandler = (err, req, res, _next) => {
  const status =
    Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;

  const payload = {
    status: "error",
    message: err?.message || "Internal Server Error",
  };

  if (err?.errors && typeof err.errors === "object") {
    payload.errors = err.errors;
  }

  if (!env.isProduction) {
    payload.stack = err?.stack;
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  res.status(status).json(payload);
};

export default errorHandler;
