import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import env from "./config/env.js";
import connectDB from "./config/db.js";

import sanitize from "./middleware/sanitize.js";
import { globalLimiter } from "./middleware/rateLimiters.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { initSocket } from "./socket/index.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import feedRoutes from "./routes/feedRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();

// 1. Hide tech fingerprint from response headers.
app.disable("x-powered-by");

// Express sits behind a reverse proxy in production (Render/Railway/etc.).
// Trusting the first proxy hop lets express-rate-limit see the real client IP.
app.set("trust proxy", 1);

// 2. Secure HTTP headers.
app.use(helmet());

// 3. Strict CORS — single origin, credentials enabled, only the verbs we use.
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);

// 4–5. Body parsers with a 10kb DoS guard.
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// 6. NoSQL-injection sanitizer (Express 5 safe — body & params only).
app.use(sanitize);

// 7. Request logging in development only.
if (env.isDevelopment) {
  app.use(morgan("dev"));
}

// 8. Global rate limit on every /api route.
app.use("/api", globalLimiter);

// 9. Health check — keep it before route mounts so it's always reachable.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// 10. Feature route mounts.
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/admin", adminRoutes);

// 11. Unknown-route + global error handlers (must be last).
app.use(notFoundHandler);
app.use(errorHandler);

// 12. Raw http.Server so Socket.io can attach to the same port as HTTP.
const server = http.createServer(app);

// 13. Socket.io — JWT-authenticated, CORS-locked, per-user private rooms.
initSocket(server);

const start = async () => {
  await connectDB();
  server.listen(env.PORT, () => {
    if (!env.isProduction) {
      console.log(
        `[server] API listening on http://localhost:${env.PORT} (${env.NODE_ENV}) — Socket.io attached`
      );
    }
  });
};

start().catch((error) => {
  console.error("[server] Failed to start:", error);
  process.exit(1);
});

const shutdown = (signal) => {
  if (!env.isProduction) {
    console.log(`[server] ${signal} received. Closing HTTP server...`);
  }
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { app, server };
