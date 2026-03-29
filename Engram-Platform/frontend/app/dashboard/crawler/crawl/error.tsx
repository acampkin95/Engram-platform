'use client';

import { useEffect } from 'react';

export default function CrawlerCrawlError({
  error: err,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Crawler Crawl Error]', err);
  }, [err]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <svg
            className="h-6 w-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <title>Error</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h2 className="mb-2 font-mono text-lg font-semibold text-[#f0eef8]">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-[#5c5878]">
          {err.message || 'An unexpected error occurred'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-[#f2a93b] px-6 py-2 text-sm font-semibold text-[#03020a] transition-colors hover:bg-[#ffc15e]"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
