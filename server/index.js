import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import env from "./config/env.js";
import connectDB from "./config/db.js";
import swaggerSpec from "./config/swagger.js";
import pkg from "./package.json" with { type: "json" };

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

// 2. Secure HTTP headers. CSP is disabled because the welcome page and the
// Swagger UI both rely on inline styles; every other helmet protection
// (frame-ancestors, X-Content-Type-Options, HSTS in prod, etc.) stays on.
app.use(helmet({ contentSecurityPolicy: false }));

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

// 9a. Swagger / OpenAPI documentation.
//   - GET /api-docs       → interactive UI
//   - GET /api-docs.json  → raw OpenAPI 3 document (handy for codegen / tests)
app.get("/api-docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Pulse API — Documentation",
    customCss: ".swagger-ui .topbar { display: none }",
  })
);

// 9b. Welcome page — minimalist, themed landing for the API root.
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(buildWelcomePage(pkg.version));
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

// Welcome HTML — themed for "Pulse", a social media platform. The chat
// bubble shapes, vibrant gradient palette and animated pulse ring all
// hint at real-time messaging and the social graph. Pure CSS, no assets.
function buildWelcomePage(version) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pulse API · v${version}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-1: #0f0c29;
      --bg-2: #302b63;
      --bg-3: #24243e;
      --accent-1: #ff6ec7;
      --accent-2: #7873f5;
      --accent-3: #4adede;
      --text: #f5f5fb;
      --muted: rgba(245, 245, 251, 0.65);
      --glass: rgba(255, 255, 255, 0.06);
      --glass-border: rgba(255, 255, 255, 0.14);
    }

    html, body { height: 100%; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Display",
        "Helvetica Neue", Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 20% 20%, rgba(255, 110, 199, 0.35), transparent 45%),
        radial-gradient(circle at 80% 30%, rgba(120, 115, 245, 0.45), transparent 50%),
        radial-gradient(circle at 50% 90%, rgba(74, 222, 222, 0.3), transparent 55%),
        linear-gradient(135deg, var(--bg-1), var(--bg-2), var(--bg-3));
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow-x: hidden;
      position: relative;
    }

    /* Floating chat bubbles in the background — pure CSS pseudo-elements */
    body::before, body::after {
      content: "";
      position: absolute;
      border-radius: 24px 24px 24px 4px;
      background: linear-gradient(135deg, rgba(255, 110, 199, 0.25), rgba(120, 115, 245, 0.2));
      backdrop-filter: blur(8px);
      pointer-events: none;
      animation: float 9s ease-in-out infinite;
    }
    body::before {
      width: 120px; height: 80px;
      top: 12%; left: 8%;
      transform: rotate(-8deg);
    }
    body::after {
      width: 160px; height: 100px;
      bottom: 14%; right: 10%;
      border-radius: 24px 24px 4px 24px;
      animation-delay: -4s;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0) rotate(-8deg); }
      50%      { transform: translateY(-22px) rotate(4deg); }
    }

    .container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 560px;
      padding: 48px 40px 32px;
      background: var(--glass);
      border: 1px solid var(--glass-border);
      border-radius: 28px;
      backdrop-filter: blur(18px) saturate(140%);
      -webkit-backdrop-filter: blur(18px) saturate(140%);
      box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
    }

    /* Animated pulse ring above the title — evokes the "pulse" of a heartbeat
       or a real-time signal, matching the brand. */
    .pulse {
      position: relative;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
      display: grid;
      place-items: center;
      box-shadow: 0 8px 30px rgba(255, 110, 199, 0.45);
    }
    .pulse::before, .pulse::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--accent-1);
      animation: ring 2.4s ease-out infinite;
    }
    .pulse::after { animation-delay: 1.2s; }

    @keyframes ring {
      0%   { transform: scale(1);   opacity: 0.7; }
      100% { transform: scale(2.2); opacity: 0;   }
    }

    .pulse-dot {
      width: 22px; height: 22px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 0 14px rgba(255, 255, 255, 0.85);
    }

    h1 {
      font-size: clamp(2.2rem, 4vw, 2.8rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, var(--accent-1), var(--accent-3) 60%, var(--accent-2));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .tagline {
      font-size: 0.95rem;
      color: var(--muted);
      max-width: 38ch;
      line-height: 1.55;
    }

    .version {
      display: inline-block;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text);
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--glass-border);
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
      margin-top: 12px;
    }

    .links a {
      text-decoration: none;
      font-size: 0.92rem;
      font-weight: 600;
      padding: 12px 22px;
      border-radius: 14px;
      transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
      will-change: transform;
    }

    .btn-primary {
      color: #1b1738;
      background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
      box-shadow: 0 10px 24px rgba(120, 115, 245, 0.35);
    }
    .btn-primary:hover { transform: translateY(-2px); filter: brightness(1.08); }

    .btn-secondary {
      color: var(--text);
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--glass-border);
    }
    .btn-secondary:hover {
      transform: translateY(-2px);
      background: rgba(255, 255, 255, 0.12);
    }

    .sign {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid var(--glass-border);
      width: 100%;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .sign a {
      color: var(--accent-3);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s ease;
    }
    .sign a:hover { color: var(--accent-1); }

    @media (max-width: 480px) {
      .container { padding: 36px 24px 24px; border-radius: 22px; }
      .links a { padding: 11px 18px; font-size: 0.88rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      body::before, body::after, .pulse::before, .pulse::after { animation: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="pulse" aria-hidden="true">
      <span class="pulse-dot"></span>
    </div>

    <h1>Pulse API</h1>
    <span class="version">v${version}</span>
    <p class="tagline">
      A real-time social media backend &mdash; authentication, follow graph,
      personalized feed, comments, likes and live notifications.
    </p>

    <div class="links">
      <a href="/api-docs" class="btn-primary">API Documentation</a>
      <a href="/api/health" class="btn-secondary">Health Check</a>
    </div>

    <footer class="sign">
      Created by
      <a href="https://serkanbayraktar.com/" target="_blank" rel="noopener noreferrer">Serkanby</a>
      |
      <a href="https://github.com/Serkanbyx" target="_blank" rel="noopener noreferrer">Github</a>
    </footer>
  </div>
</body>
</html>`;
}

export { app, server };
