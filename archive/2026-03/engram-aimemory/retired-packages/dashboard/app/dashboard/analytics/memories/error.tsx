"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
      <p className="text-gray-500 text-sm max-w-md text-center">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
