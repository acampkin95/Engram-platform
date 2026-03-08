import { Skeleton } from '@/src/components/ui/skeleton';
import { cn } from '@/src/lib/utils';

// ─── Primitive ────────────────────────────────────────────────────────

/** Render N skeleton text lines with decreasing widths */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ['w-full', 'w-4/5', 'w-3/5', 'w-2/3', 'w-1/2'];
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder list
          key={`skel-line-${i}`}
          className={cn('h-3 rounded bg-white/[0.04]', widths[i % widths.length])}
        />
      ))}
    </div>
  );
}

// ─── StatCard Skeleton ────────────────────────────────────────────────────────

export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl p-4 border border-white/[0.06] bg-[#090818]', className)}>
      <Skeleton className="h-3 w-24 mb-3 rounded bg-white/[0.04]" />
      <Skeleton className="h-8 w-16 rounded bg-white/[0.06]" />
      <Skeleton className="h-3 w-20 mt-2 rounded bg-white/[0.04]" />
    </div>
  );
}

// ─── Card Skeleton ────────────────────────────────────────────────────────────

export function SkeletonCard({ height, className }: { height?: string; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.06] bg-[#090818] overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <Skeleton className="h-5 w-40 rounded bg-white/[0.04]" />
      </div>
      {/* Body */}
      <div className={cn('p-5', height)}>
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}

// ─── Table Skeleton ───────────────────────────────────────────────────────────

function SkeletonTableRow() {
  return (
    <div className="flex gap-4 px-4 py-3">
      <Skeleton className="h-3 w-24 rounded bg-white/[0.04]" />
      <Skeleton className="h-3 w-32 rounded bg-white/[0.04]" />
      <Skeleton className="h-3 w-16 rounded bg-white/[0.04]" />
      <Skeleton className="h-3 w-20 rounded bg-white/[0.04]" />
      <Skeleton className="h-3 w-12 ml-auto rounded bg-white/[0.04]" />
    </div>
  );
}

export function SkeletonDataTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-white/[0.06] overflow-hidden', className)}>
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-[#090818] border-b border-white/[0.06]">
        {['w-24', 'w-32', 'w-16', 'w-20', 'w-12'].map((w) => (
          <Skeleton key={w} className={cn('h-3 rounded bg-white/[0.03]', w)} />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-white/[0.04]">
        {Array.from({ length: rows }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder list
          <SkeletonTableRow key={`skel-row-${i}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard Home Skeleton ──────────────────────────────────────────────────

export function SkeletonDashboardHome() {
  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <Skeleton className="h-7 w-48 rounded bg-white/[0.06]" />
        <Skeleton className="h-3 w-64 mt-2 rounded bg-white/[0.04]" />
      </div>

      {/* Stats grid */}
      <section>
        <Skeleton className="h-4 w-24 mb-4 rounded bg-white/[0.04]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder list
            <SkeletonStatCard key={`skel-stat-${i}`} />
          ))}
        </div>
      </section>

      {/* Service health */}
      <section>
        <Skeleton className="h-4 w-28 mb-4 rounded bg-white/[0.04]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard height="h-48" />
          <SkeletonCard height="h-48" />
        </div>
      </section>

      {/* Quick links */}
      <section>
        <Skeleton className="h-4 w-24 mb-4 rounded bg-white/[0.04]" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder list
            <Skeleton key={`skel-link-${i}`} className="h-20 rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Analytics Skeleton ───────────────────────────────────────────────────────

export function SkeletonAnalytics() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Skeleton className="h-6 w-32 rounded bg-white/[0.06]" />

      {/* Filter bar */}
      <Skeleton className="h-14 w-full rounded-xl bg-white/[0.04]" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder list
          <SkeletonStatCard key={`skel-anl-${i}`} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/[0.06] bg-[#090818] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <Skeleton className="h-5 w-48 rounded bg-white/[0.04]" />
          </div>
          <Skeleton className="m-5 h-[280px] rounded bg-white/[0.04]" />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#090818] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <Skeleton className="h-5 w-40 rounded bg-white/[0.04]" />
          </div>
          <Skeleton className="m-5 h-[280px] rounded bg-white/[0.04]" />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/[0.06] bg-[#090818] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <Skeleton className="h-5 w-44 rounded bg-white/[0.04]" />
          </div>
          <Skeleton className="m-5 h-[220px] rounded bg-white/[0.04]" />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#090818] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <Skeleton className="h-5 w-36 rounded bg-white/[0.04]" />
          </div>
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder list
              <div key={`skel-act-${i}`} className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded bg-white/[0.04]" />
                <Skeleton className="h-5 flex-1 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Bar Skeleton ──────────────────────────────────────────────────────

export function SkeletonFilterBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 p-3.5 rounded-xl bg-[#090818] border border-white/[0.06]',
        className,
      )}
    >
      <Skeleton className="h-4 w-4 rounded bg-white/[0.04]" />
      <Skeleton className="h-5 w-px bg-white/[0.06]" />
      <Skeleton className="h-9 w-48 rounded-lg bg-white/[0.04]" />
      <Skeleton className="h-9 w-32 rounded-lg bg-white/[0.04]" />
      <Skeleton className="h-9 w-40 rounded-lg bg-white/[0.04]" />
    </div>
  );
}

// ─── Chat View Skeleton ─────────────────────────────────────────────────────

export function SkeletonChatView({ messages = 8 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: messages }).map((_, i) => (
        <div
          key={`skel-chat-${i}`}
          className={cn(
            'flex gap-3',
            i % 2 === 0 ? 'justify-start' : 'justify-end',
          )}
        >
          {i % 2 === 0 ? (
<>
<Skeleton className="h-10 w-10 rounded-full bg-white/[0.04]" />
<div className="flex-1 space-y-2">
<Skeleton className="h-4 w-32 rounded bg-white/[0.04]" />
<Skeleton className="h-16 w-full rounded-lg bg-white/[0.04]" />
</div>
</>
) : (
<div className="flex-1 space-y-2">
<Skeleton className="h-4 w-24 ml-auto rounded bg-white/[0.04]" />
<Skeleton className="h-16 w-full rounded-lg bg-white/[0.04]" />
</div>
)}
        </div>
      ))}
    </div>
  );
}

// ─── Knowledge Graph Skeleton ─────────────────────────────────────────────────

export function SkeletonGraphView() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center space-y-4">
        <Skeleton className="h-8 w-48 mx-auto rounded bg-white/[0.06]" />
        <Skeleton className="h-4 w-64 mx-auto rounded bg-white/[0.04]" />
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={`skel-node-${i}`}
              className="h-16 w-16 rounded-full bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
