import { Server } from "socket.io";
import env from "../config/env.js";
import socketAuth from "./socketAuth.js";

let io = null;

// Tracks which users currently have at least one open socket. A single user
// may have multiple connections (multiple tabs/devices), so we store a Set of
// socket IDs per user. The map is in-memory only — fine for a single server
// instance. Multi-instance deployments would need a Redis adapter (see
// README / future work).
const onlineUsers = new Map();

const addSocket = (userId, socketId) => {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
};

const removeSocket = (userId, socketId) => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(userId);
};

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.use(socketAuth);

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    addSocket(userId, socket.id);

    socket.join(`user:${userId}`);

    if (env.isDevelopment) {
      console.log(`[socket] connected user=${userId} socket=${socket.id}`);
    }

    socket.on("disconnect", (reason) => {
      removeSocket(userId, socket.id);
      if (env.isDevelopment) {
        console.log(
          `[socket] disconnected user=${userId} socket=${socket.id} reason=${reason}`
        );
      }
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialised. Call initSocket(httpServer) first.");
  }
  return io;
};

export const isOnline = (userId) => onlineUsers.has(String(userId));

export const getOnlineCount = () => onlineUsers.size;

export default { initSocket, getIo, isOnline, getOnlineCount };
