import { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isOnline) setDismissed(false);
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-100 flex items-center justify-between gap-3 px-4 py-2 bg-neon-r/10 text-neon-r border-b border-neon-r/20 backdrop-blur-sm text-sm font-mono"
    >
      <span>You are offline. Reconnecting&hellip;</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded px-2 py-0.5 text-xs hover:bg-neon-r/20 transition-colors"
        aria-label="Dismiss offline notification"
      >
        &times;
      </button>
    </div>
  );
}
