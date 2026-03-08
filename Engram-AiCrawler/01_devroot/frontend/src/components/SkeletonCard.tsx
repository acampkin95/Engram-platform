import { Skeleton } from'./Skeleton';

interface SkeletonCardProps {
 rows?: number;
 showHeader?: boolean;
 className?: string;
}

export function SkeletonCard({ rows = 3, showHeader = true, className ='' }: SkeletonCardProps) {
 return (
 <div className={`bg-surface border border-border p-4 space-y-3 ${className}`}>
 {showHeader && (
 <div className="flex items-center justify-between">
 <Skeleton className="h-4 w-1/2" />
 <Skeleton className="h-5 w-16 rounded-full" />
 </div>
 )}
 {Array.from({ length: rows }).map((_, i) => (
 <Skeleton
 key={i}
 className={`h-3.5 ${i === rows - 1 ?'w-3/5' : i % 2 === 0 ?'w-full' :'w-5/6'}`}
 />
 ))}
 </div>
 );
}

export function SkeletonStatCard() {
 return (
 <div className="bg-surface p-6 border border-border animate-pulse">
 <div className="flex items-start justify-between mb-4">
 <Skeleton className="w-12 h-12" />
 <Skeleton className="w-16 h-6 rounded-full" />
 </div>
 <Skeleton className="w-16 h-8 mb-2" />
 <Skeleton className="w-24 h-4" />
 </div>
 );
}
