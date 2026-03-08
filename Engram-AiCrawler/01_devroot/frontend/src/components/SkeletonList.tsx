import { Skeleton } from'./Skeleton';

interface SkeletonListProps {
 rows?: number;
 showAvatar?: boolean;
 showAction?: boolean;
 className?: string;
}

export function SkeletonList({ rows = 5, showAvatar = false, showAction = true, className ='' }: SkeletonListProps) {
 return (
 <div className={`divide-y divide-border ${className}`}>
 {Array.from({ length: rows }).map((_, i) => (
 <div key={i} className="flex items-center gap-3 px-4 py-3.5">
 {showAvatar && <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />}
 <div className="flex-1 space-y-1.5">
 <Skeleton className={`h-3.5 ${i % 3 === 0 ?'w-2/3' : i % 3 === 1 ?'w-1/2' :'w-3/4'}`} />
 <Skeleton className="h-3 w-1/3" />
 </div>
 {showAction && <Skeleton className="w-16 h-7 flex-shrink-0" />}
 </div>
 ))}
 </div>
 );
}

export function SkeletonListItem({ showAvatar = false }: { showAvatar?: boolean }) {
 return (
 <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
 {showAvatar && <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />}
 <div className="flex-1 space-y-1.5">
 <Skeleton className="h-3.5 w-2/3" />
 <Skeleton className="h-3 w-1/3" />
 </div>
 <Skeleton className="w-16 h-7 flex-shrink-0" />
 </div>
 );
}
