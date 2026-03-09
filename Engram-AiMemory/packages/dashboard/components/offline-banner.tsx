"use client";

import { useOffline } from "@/hooks/use-offline";

/**
 * Renders a fixed top banner when the browser loses network connectivity.
 * Returns null when online so it has zero layout impact.
 */
export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed left-0 right-0 top-0 z-50 bg-yellow-500 px-4 py-2 text-center text-sm font-medium text-yellow-900"
    >
      You are offline. Some features may be unavailable.
    </div>
  );
}
