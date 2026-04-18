import { useEffect, useState } from "react";

/**
 * useOnlineStatus — boolean reflecting `navigator.onLine`, kept in sync
 * with the browser `online` / `offline` events.
 *
 * Used by `MainLayout` to render an offline banner so the user understands
 * why network-dependent actions (post, like, follow) might be failing.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}

export default useOnlineStatus;
