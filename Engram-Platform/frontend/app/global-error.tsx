'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorState } from '@/src/design-system/components/ErrorState';

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    Sentry.captureException(error, { extra: { digest: error.digest } });
    console.error('[Global Error]', error);
  }, [error]);

  const errorMessage = error.message || 'An unexpected error occurred. Please try again.';

  return (
    <html lang="en">
      <body className="antialiased bg-[#03020a] text-[#f0eef8]">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <ErrorState message={errorMessage} onRetry={reset} className="w-full max-w-xl" />
          {error.digest && (
            <p className="font-mono text-xs text-white/30 mt-4">Error ID: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
