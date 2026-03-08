'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/src/design-system/components/ErrorState';

export default function DashboardError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error('[Dashboard Error]', error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <ErrorState
        message={error.message || 'Something went wrong loading this section. Your data is safe.'}
        onRetry={reset}
        className="w-full max-w-xl"
      />
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-white/30">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
