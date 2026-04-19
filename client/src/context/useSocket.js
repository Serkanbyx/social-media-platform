import { createContext, useContext } from "react";

/**
 * Socket context object + `useSocket` hook live here (separate from the
 * `<SocketProvider>` component file) so React's Fast Refresh can keep
 * working — the rule requires component files to *only* export
 * components.
 */
export const SocketContext = createContext(null);

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within a SocketProvider.");
  }
  return ctx;
}
