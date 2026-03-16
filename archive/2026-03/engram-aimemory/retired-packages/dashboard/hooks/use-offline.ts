"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the browser has no network connectivity.
 * Listens to the native online/offline events for real-time updates.
 */
export function useOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Sync initial state with the browser's connectivity status
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOffline;
}
