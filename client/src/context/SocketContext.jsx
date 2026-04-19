import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

import { useAuth } from "./useAuth.js";

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

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user || !token) {
      setSocket(null);
      return undefined;
    }

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

    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, [user, token]);

  const value = useMemo(() => ({ socket }), [socket]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within a SocketProvider.");
  }
  return ctx;
}
