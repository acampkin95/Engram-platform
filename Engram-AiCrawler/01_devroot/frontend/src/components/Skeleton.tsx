interface SkeletonProps {
 className?: string;
}

export function Skeleton({ className ='' }: SkeletonProps) {
 return (
 <div
  className={`bg-raised bg-gradient-to-r from-abyss via-raised to-abyss bg-[length:200%_100%] animate-shimmer ${className}`}
 aria-hidden="true"
 />
 );
}
