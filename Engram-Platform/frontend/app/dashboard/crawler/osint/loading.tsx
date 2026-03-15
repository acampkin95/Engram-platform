import { SkeletonFilterBar, SkeletonStatCard } from '@/src/components/Skeletons';

export default function CrawlerOsintLoading() {
  return (
    <div className="space-y-6">
      <SkeletonFilterBar />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
    </div>
  );
}
