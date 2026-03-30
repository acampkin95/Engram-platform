'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/src/design-system/components/ErrorState';

export default function AuditLogError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error('[Audit Log Error]', error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 border border-white/5 bg-layer-1 rounded-xl">
      <ErrorState
        message={error.message || 'Failed to load audit log.'}
        onRetry={reset}
        className="w-full max-w-xl"
      />
    </div>
  );
}
