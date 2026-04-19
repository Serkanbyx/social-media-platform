import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

import { useAuth } from "./useAuth.js";
import { SocketContext } from "./useSocket.js";

/**
 * SocketContext — opens a single, authenticated Socket.IO connection while
 * the user is signed in.
 *
 * Design notes:
 *  - The handshake re-uses the same JWT we send to the REST API. The server
 *    rejects invalid/expired tokens in `socketAuth.js`, so there's nothing
 *    extra to protect against on the client.
 *  - `transports: ["websocket"]` skips the long-polling fallback. Modern
 *    browsers all support WS, and skipping HTTP polling avoids extra
 *    requests through the auth-stripping CDN.
 *  - The connection is recreated whenever `user` or `token` changes (login,
 *    logout, token rotation) and torn down on unmount, so we never leak
 *    multiple sockets.
 */

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user || !token) return undefined;

    const url = import.meta.env.VITE_SOCKET_URL;
    if (!url) {
      if (import.meta.env.DEV) {
        console.warn(
          "[socket] VITE_SOCKET_URL is not defined. Copy client/.env.example to .env and restart Vite."
        );
      }
      return undefined;
    }

    const instance = io(url, {
      auth: { token },
      transports: ["websocket"],
    });

    // Subscribe to the external system (socket.io) and only mirror its
    // state into React from event callbacks — this satisfies the
    // "no synchronous setState in effect body" rule.
    const handleConnect = () => setSocket(instance);
    const handleDisconnect = () => setSocket(null);

    instance.on("connect", handleConnect);
    instance.on("disconnect", handleDisconnect);

    return () => {
      instance.off("connect", handleConnect);
      instance.off("disconnect", handleDisconnect);
      instance.disconnect();
    };
  }, [user, token]);

  const value = useMemo(() => ({ socket }), [socket]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}
