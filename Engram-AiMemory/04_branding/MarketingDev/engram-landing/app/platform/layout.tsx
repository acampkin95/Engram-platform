import Link from 'next/link';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Breadcrumb Navigation */}
      <nav className="border-b border-[var(--border)]/50 sticky top-0 z-40 bg-[var(--void)]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 text-sm font-[var(--font-mono)] text-[var(--text-secondary)] tracking-wide">
            <Link
              href="/"
              className="hover:text-[var(--engram-amber)] transition-colors duration-200 hover:underline underline-offset-4"
            >
              Home
            </Link>
            <span className="text-[var(--text-muted)] opacity-40">/</span>
            <Link
              href="/platform"
              className="hover:text-[var(--engram-amber)] transition-colors duration-200 hover:underline underline-offset-4"
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
