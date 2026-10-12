import { useEffect, useState } from "react";

/** Installation status belongs to the service worker lifecycle, independent of
 * exercise connectivity and server-authoritative verification. */
export function useOfflineStatus() {
  const [status, setStatus] = useState("preparing");
  useEffect(() => {
    const update = () =>
      setStatus(document.documentElement.dataset.offlineStatus || "preparing");
    update();
    window.addEventListener("vyuha-offline-status", update);
    return () => window.removeEventListener("vyuha-offline-status", update);
  }, []);
  return status;
}
