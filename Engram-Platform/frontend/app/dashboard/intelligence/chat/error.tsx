'use client';

import { useEffect } from 'react';
import { Button } from '@/src/components/ui/button';

interface ChatErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ChatError({ error, reset }: ChatErrorProps) {
  useEffect(() => {
    console.error('Chat error:', error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="mb-4 text-xl font-bold text-[var(--color-text)]">Chat unavailable</h2>
        <p className="mb-6 text-[var(--color-text-muted)]">
          We couldn&apos;t load the chat interface. Please try again or return to the dashboard.
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={reset} variant="secondary">
            Try again
          </Button>
          <Button
            onClick={() => (window.location.href = '/dashboard/intelligence')}
            variant="ghost"
          >
            Back to Intelligence
          </Button>
        </div>
      </div>
    </div>
  );
}
