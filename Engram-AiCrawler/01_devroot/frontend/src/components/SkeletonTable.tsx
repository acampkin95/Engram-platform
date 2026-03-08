import { Skeleton } from'./Skeleton';

interface SkeletonTableProps {
 rows?: number;
 columns?: number;
 showHeader?: boolean;
}

export function SkeletonTable({ rows = 5, columns = 4, showHeader = true }: SkeletonTableProps) {
 return (
 <div className="w-full overflow-hidden">
 {showHeader && (
 <div className="flex gap-4 px-4 py-3 border-b border-border bg-surface/50">
 {Array.from({ length: columns }).map((_, i) => (
 <Skeleton key={i} className={`h-3 ${i === 0 ?'w-1/4' : i === columns - 1 ?'w-16 ml-auto' :'w-1/6'}`} />
 ))}
 </div>
 )}
 <div className="divide-y divide-border">
 {Array.from({ length: rows }).map((_, rowIdx) => (
 <div key={rowIdx} className="flex gap-4 items-center px-4 py-3.5">
 {Array.from({ length: columns }).map((_, colIdx) => (
 <Skeleton
 key={colIdx}
 className={`h-3.5 ${
 colIdx === 0
 ?'w-1/3'
 : colIdx === columns - 1
 ?'w-16 ml-auto'
 : colIdx % 2 === 0
 ?'w-1/5'
 :'w-1/4'
 }`}
 />
 ))}
 </div>
 ))}
 </div>
 </div>
 );
}

export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
 return (
 <div className="flex gap-4 items-center px-4 py-3.5 border-b border-border">
 {Array.from({ length: columns }).map((_, i) => (
 <Skeleton key={i} className={`h-3.5 ${i === 0 ?'w-1/3' : i === columns - 1 ?'w-16 ml-auto' :'w-1/5'}`} />
 ))}
 </div>
 );
}
