import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        <div
          className="font-[var(--font-display)] font-black text-[8rem] leading-none mb-4"
          style={{
            background: 'linear-gradient(135deg, #FFC15E 0%, #F2A93B 40%, #9B7DE0 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          404
        </div>
        <h1 className="font-[var(--font-display)] font-bold text-2xl mb-4">
          Page Not Found
        </h1>
        <p className="font-[var(--font-body)] text-[var(--text-secondary)] mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full font-[var(--font-display)] font-semibold px-6 py-3 bg-[var(--engram-amber)] text-[var(--void)] hover:bg-opacity-90 transition-all duration-300"
          >
            Back to Home
          </Link>
          <Link
            href="/knowledge-base"
            className="inline-flex items-center justify-center rounded-full font-[var(--font-display)] font-semibold px-6 py-3 border border-[var(--text-secondary)]/30 hover:bg-[var(--layer-0)] transition-all duration-300"
          >
            Knowledge Base
          </Link>
        </div>
      </div>
    </div>
  );
}
