import Link from 'next/link';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Breadcrumb */}
      <nav className="border-b border-[var(--border)] sticky top-0 z-40 bg-[var(--void)]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-[var(--font-mono)] text-[var(--text-secondary)]">
            <Link
              href="/"
              className="hover:text-[var(--engram-amber)] transition-colors"
            >
              Home
            </Link>
            <span className="text-[var(--text-muted)]">/</span>
            <Link
              href="/platform"
              className="hover:text-[var(--engram-amber)] transition-colors"
            >
              Platform
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-20">{children}</main>
    </div>
  );
}
