import swaggerJsdoc from "swagger-jsdoc";
import pkg from "../package.json" with { type: "json" };

import env from "./env.js";

// Reusable response shapes for OpenAPI components.
// Defining them once at the top keeps the path declarations terse and DRY.
const errorResponse = {
  type: "object",
  properties: {
    status: { type: "string", example: "error" },
    message: { type: "string", example: "Something went wrong." },
    errors: {
      type: "object",
      additionalProperties: { type: "string" },
      nullable: true,
    },
  },
};

const cursorMeta = {
  type: "object",
  properties: {
    nextCursor: { type: "string", nullable: true, example: "65f1c9..." },
    hasMore: { type: "boolean", example: true },
  },
};

const userPublic = {
  type: "object",
  properties: {
    _id: { type: "string", example: "65f1c9a7e1b2c3d4e5f60001" },
    username: { type: "string", example: "serkanby" },
    name: { type: "string", example: "Serkan Bayraktar" },
    avatarUrl: { type: "string", nullable: true, example: "https://res.cloudinary.com/.../avatar.jpg" },
    bio: { type: "string", example: "Full-stack engineer." },
    followersCount: { type: "integer", example: 128 },
    followingCount: { type: "integer", example: 42 },
    postsCount: { type: "integer", example: 17 },
    isPrivate: { type: "boolean", example: false },
    role: { type: "string", enum: ["user", "admin"], example: "user" },
    createdAt: { type: "string", format: "date-time" },
  },
};

const post = {
  type: "object",
  properties: {
    _id: { type: "string" },
    author: { $ref: "#/components/schemas/UserPublic" },
    content: { type: "string", example: "Hello world!" },
    imageUrl: { type: "string", nullable: true },
    likesCount: { type: "integer", example: 12 },
    commentsCount: { type: "integer", example: 3 },
    isLikedByMe: { type: "boolean", example: false },
    isHidden: { type: "boolean", example: false },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const comment = {
  type: "object",
  properties: {
    _id: { type: "string" },
    author: { $ref: "#/components/schemas/UserPublic" },
    post: { type: "string" },
    content: { type: "string", example: "Great post!" },
    createdAt: { type: "string", format: "date-time" },
  },
};

const notification = {
  type: "object",
  properties: {
    _id: { type: "string" },
    type: { type: "string", enum: ["follow", "like", "comment"] },
    actor: { $ref: "#/components/schemas/UserPublic" },
    post: { type: "string", nullable: true },
    isRead: { type: "boolean", example: false },
    createdAt: { type: "string", format: "date-time" },
  },
};

// Bearer-token auth shorthand for protected endpoints.
const auth = [{ bearerAuth: [] }];

// Common parameter blocks reused across many paths.
const cursorParam = {
  in: "query",
  name: "cursor",
  schema: { type: "string" },
  description: "Opaque pagination cursor returned by the previous response.",
};
const limitParam = {
  in: "query",
  name: "limit",
  schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
  description: "Page size (1–50).",
};

const definition = {
  openapi: "3.0.3",
  info: {
    title: "Pulse — Social Media Platform API",
    version: pkg.version,
    description:
      "REST API for **Pulse**, a full-stack MERN social platform. Covers authentication, profiles, follow graph, posts, comments, likes, the personalized feed, real-time notifications, uploads, and admin moderation.",
    contact: {
      name: "Serkanby",
      url: "https://serkanbayraktar.com/",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "https://social-media-platform-u4xr.onrender.com",
      description: "Production (Render)",
    },
    {
      url: `http://localhost:${env.PORT}`,
      description: "Local development",
    },
  ],
  tags: [
    { name: "Health", description: "Service health probe." },
    { name: "Auth", description: "Registration, login and account lifecycle." },
    { name: "Users", description: "Profile lookup, search and follow toggle." },
    { name: "Posts", description: "Post CRUD, explore feed, likes." },
    { name: "Comments", description: "Comment creation, listing and deletion." },
    { name: "Feed", description: "Personalized timeline." },
    { name: "Notifications", description: "Real-time notification surface." },
    { name: "Uploads", description: "Cloudinary-backed avatar uploads." },
    { name: "Admin", description: "Moderation surface (admin role required)." },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Paste the JWT returned by `/api/auth/login` as `Bearer <token>`.",
      },
    },
    schemas: {
      Error: errorResponse,
      CursorMeta: cursorMeta,
      UserPublic: userPublic,
      Post: post,
      Comment: comment,
      Notification: notification,
      AuthResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "success" },
          token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6..." },
          user: { $ref: "#/components/schemas/UserPublic" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid authentication token.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Forbidden: {
        description: "The viewer is not allowed to perform this action.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: {
        description: "Resource not found.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      ValidationError: {
        description: "Request body or query failed validation.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      RateLimited: {
        description: "Too many requests — rate limit exceeded.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
  },
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness probe",
        description: "Returns service status, uptime and active environment.",
        responses: {
          200: {
            description: "Service is reachable.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    uptime: { type: "number", example: 1234.56 },
                    env: { type: "string", example: "development" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "username", "email", "password"],
                properties: {
                  name: { type: "string", example: "Serkan Bayraktar" },
                  username: { type: "string", example: "serkanby" },
                  email: { type: "string", format: "email", example: "user@example.com" },
                  password: { type: "string", format: "password", minLength: 8, example: "Str0ng!Pass" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Account created and JWT issued.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          409: {
            description: "Email or username already in use.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Sign in with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "user@example.com" },
                  password: { type: "string", format: "password", example: "Str0ng!Pass" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "JWT issued.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the currently authenticated user",
        security: auth,
        responses: {
          200: {
            description: "Current user profile.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/UserPublic" } },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/auth/change-password": {
      patch: {
        tags: ["Auth"],
        summary: "Change the current account password",
        security: auth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string", format: "password" },
                  newPassword: { type: "string", format: "password", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Password updated." },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/auth/delete-account": {
      delete: {
        tags: ["Auth"],
        summary: "Permanently delete the current account",
        security: auth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: { password: { type: "string", format: "password" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Account and related data deleted." },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/users/search": {
      get: {
        tags: ["Users"],
        summary: "Search users by name or username",
        parameters: [
          {
            in: "query",
            name: "q",
            required: true,
            schema: { type: "string", minLength: 1, maxLength: 30 },
            description: "Search query — matches `name` or `username`.",
          },
        ],
        responses: {
          200: {
            description: "Matching users.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: {
                      type: "array",
                      items: { $ref: "#/components/schemas/UserPublic" },
                    },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/api/users/me": {
      patch: {
        tags: ["Users"],
        summary: "Update the current user's profile",
        security: auth,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", maxLength: 50 },
                  username: { type: "string", minLength: 3, maxLength: 30 },
                  bio: { type: "string", maxLength: 160 },
                  preferences: {
                    type: "object",
                    properties: {
                      isPrivate: { type: "boolean" },
                      theme: { type: "string", enum: ["light", "dark", "system"] },
                      reduceMotion: { type: "boolean" },
                      notifications: { type: "object", additionalProperties: { type: "boolean" } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated profile.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/UserPublic" } },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          409: {
            description: "Chosen username already taken.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/api/users/{username}": {
      get: {
        tags: ["Users"],
        summary: "Get a public user profile by username",
        parameters: [
          { in: "path", name: "username", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Profile payload (with `isFollowing` if the viewer is signed in).",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/UserPublic" },
                    {
                      type: "object",
                      properties: { isFollowing: { type: "boolean", example: false } },
                    },
                  ],
                },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/users/{username}/followers": {
      get: {
        tags: ["Users"],
        summary: "List the followers of a user",
        parameters: [
          { in: "path", name: "username", required: true, schema: { type: "string" } },
          cursorParam,
          limitParam,
        ],
        responses: {
          200: {
            description: "Cursor-paginated follower list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: { type: "array", items: { $ref: "#/components/schemas/UserPublic" } },
                    meta: { $ref: "#/components/schemas/CursorMeta" },
                  },
                },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/users/{username}/following": {
      get: {
        tags: ["Users"],
        summary: "List who a user follows",
        parameters: [
          { in: "path", name: "username", required: true, schema: { type: "string" } },
          cursorParam,
          limitParam,
        ],
        responses: {
          200: {
            description: "Cursor-paginated following list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: { type: "array", items: { $ref: "#/components/schemas/UserPublic" } },
                    meta: { $ref: "#/components/schemas/CursorMeta" },
                  },
                },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/users/{id}/follow": {
      post: {
        tags: ["Users"],
        summary: "Toggle follow / unfollow on a user",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "New follow state and updated counters.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    isFollowing: { type: "boolean" },
                    followersCount: { type: "integer" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },

    "/api/posts": {
      post: {
        tags: ["Posts"],
        summary: "Create a new post (text and / or image)",
        security: auth,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  content: { type: "string", maxLength: 500 },
                  image: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Created post.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Post" } } },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/posts/explore": {
      get: {
        tags: ["Posts"],
        summary: "Public trending feed",
        parameters: [cursorParam, limitParam],
        responses: {
          200: {
            description: "Cursor-paginated public posts.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    posts: { type: "array", items: { $ref: "#/components/schemas/Post" } },
                    meta: { $ref: "#/components/schemas/CursorMeta" },
                  },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/api/posts/user/{username}": {
      get: {
        tags: ["Posts"],
        summary: "List posts authored by a user",
        parameters: [
          { in: "path", name: "username", required: true, schema: { type: "string" } },
          cursorParam,
          limitParam,
        ],
        responses: {
          200: {
            description: "Cursor-paginated post list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    posts: { type: "array", items: { $ref: "#/components/schemas/Post" } },
                    meta: { $ref: "#/components/schemas/CursorMeta" },
                  },
                },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/posts/{id}": {
      get: {
        tags: ["Posts"],
        summary: "Get a single post by id",
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Post payload.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Post" } } },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Posts"],
        summary: "Edit a post (owner or admin only)",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { content: { type: "string", maxLength: 500 } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated post.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Post" } } },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Posts"],
        summary: "Delete a post (owner or admin only)",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Post and cascaded resources deleted." },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/posts/{id}/like": {
      post: {
        tags: ["Posts"],
        summary: "Toggle like / unlike on a post",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "New like state and counter.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    isLikedByMe: { type: "boolean" },
                    likesCount: { type: "integer" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/api/posts/{postId}/comments": {
      post: {
        tags: ["Comments"],
        summary: "Add a comment to a post",
        security: auth,
        parameters: [
          { in: "path", name: "postId", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: { content: { type: "string", maxLength: 280 } },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Created comment.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Comment" } } },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
      get: {
        tags: ["Comments"],
        summary: "List comments under a post",
        parameters: [
          { in: "path", name: "postId", required: true, schema: { type: "string" } },
          cursorParam,
          limitParam,
        ],
        responses: {
          200: {
            description: "Cursor-paginated comment list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    comments: { type: "array", items: { $ref: "#/components/schemas/Comment" } },
                    meta: { $ref: "#/components/schemas/CursorMeta" },
                  },
                },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/comments/{id}": {
      delete: {
        tags: ["Comments"],
        summary: "Delete a comment (owner, post author or admin)",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Comment deleted; counters cascaded." },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/feed": {
      get: {
        tags: ["Feed"],
        summary: "Personalized timeline of followed authors",
        security: auth,
        parameters: [cursorParam, limitParam],
        responses: {
          200: {
            description: "Cursor-paginated personalized feed.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    posts: { type: "array", items: { $ref: "#/components/schemas/Post" } },
                    meta: { $ref: "#/components/schemas/CursorMeta" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List notifications for the current user",
        security: auth,
        parameters: [cursorParam, limitParam],
        responses: {
          200: {
            description: "Cursor-paginated notification list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    notifications: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Notification" },
                    },
                    meta: { $ref: "#/components/schemas/CursorMeta" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/notifications/unread-count": {
      get: {
        tags: ["Notifications"],
        summary: "Get the unread notification count (badge value)",
        security: auth,
        responses: {
          200: {
            description: "Unread count.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { count: { type: "integer", example: 3 } },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/notifications/read-all": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark every notification as read",
        security: auth,
        responses: {
          200: { description: "All notifications marked as read." },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/notifications/{id}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark a single notification as read",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Notification marked as read." },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/notifications/{id}": {
      delete: {
        tags: ["Notifications"],
        summary: "Delete a notification (recipient only)",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Notification deleted." },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    "/api/uploads/avatar": {
      post: {
        tags: ["Uploads"],
        summary: "Upload (or replace) the current user's avatar",
        security: auth,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["avatar"],
                properties: { avatar: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Avatar updated.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { avatarUrl: { type: "string" } },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
      delete: {
        tags: ["Uploads"],
        summary: "Remove the current user's avatar",
        security: auth,
        responses: {
          200: { description: "Avatar removed." },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },

    "/api/admin/stats": {
      get: {
        tags: ["Admin"],
        summary: "Dashboard counters and top users",
        security: auth,
        responses: {
          200: {
            description: "Aggregate statistics payload.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: { type: "integer" },
                    posts: { type: "integer" },
                    comments: { type: "integer" },
                    likes: { type: "integer" },
                    topUsers: {
                      type: "array",
                      items: { $ref: "#/components/schemas/UserPublic" },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "List users with optional filters",
        security: auth,
        parameters: [
          cursorParam,
          limitParam,
          { in: "query", name: "q", schema: { type: "string" }, description: "Search by name / username / email." },
          { in: "query", name: "role", schema: { type: "string", enum: ["user", "admin"] } },
          { in: "query", name: "isActive", schema: { type: "boolean" } },
        ],
        responses: {
          200: {
            description: "Paginated user list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: { type: "array", items: { $ref: "#/components/schemas/UserPublic" } },
                    meta: { $ref: "#/components/schemas/CursorMeta" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/admin/users/{id}/role": {
      patch: {
        tags: ["Admin"],
        summary: "Promote or demote a user",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: { role: { type: "string", enum: ["user", "admin"] } },
              },
            },
          },
        },
        responses: {
          200: { description: "Role updated." },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/admin/users/{id}/active": {
      patch: {
        tags: ["Admin"],
        summary: "Enable or disable a user account",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["isActive"],
                properties: { isActive: { type: "boolean" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Account status updated." },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/admin/users/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Hard-delete a user (with cascade)",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "User and cascaded resources deleted." },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/admin/posts": {
      get: {
        tags: ["Admin"],
        summary: "List every post (includes hidden)",
        security: auth,
        parameters: [cursorParam, limitParam],
        responses: {
          200: {
            description: "Paginated post list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    posts: { type: "array", items: { $ref: "#/components/schemas/Post" } },
                    meta: { $ref: "#/components/schemas/CursorMeta" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/admin/posts/{id}/hide": {
      patch: {
        tags: ["Admin"],
        summary: "Toggle the `isHidden` flag on a post",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Hidden flag toggled." },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/admin/posts/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Hard-delete a post (with cascade)",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Post deleted." },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/admin/comments": {
      get: {
        tags: ["Admin"],
        summary: "List comments across every post",
        security: auth,
        parameters: [cursorParam, limitParam],
        responses: {
          200: {
            description: "Paginated comment list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    comments: { type: "array", items: { $ref: "#/components/schemas/Comment" } },
                    meta: { $ref: "#/components/schemas/CursorMeta" },
                  },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/admin/comments/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Hard-delete a comment (with cascade)",
        security: auth,
        parameters: [
          { in: "path", name: "id", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Comment deleted." },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJsdoc({
  definition,
  // No JSDoc comment scanning — the spec is fully declared above so it stays
  // self-contained, framework-agnostic, and trivially testable.
  apis: [],
});

export default swaggerSpec;
