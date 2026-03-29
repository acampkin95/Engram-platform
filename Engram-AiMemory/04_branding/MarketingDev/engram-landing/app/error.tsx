'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
          <div className="w-8 h-8 rounded-full bg-red-500/40" />
        </div>
        <h1 className="font-[var(--font-display)] font-bold text-2xl mb-4">
          Something went wrong
        </h1>
        <p className="font-[var(--font-body)] text-[var(--text-secondary)] mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-full font-[var(--font-display)] font-semibold px-6 py-3 bg-[var(--engram-amber)] text-[var(--void)] hover:bg-opacity-90 transition-all duration-300"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
