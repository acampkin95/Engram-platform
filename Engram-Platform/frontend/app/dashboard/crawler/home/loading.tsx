import { SkeletonDataTable } from '@/src/components/Skeletons';

export default function CrawlerHomeLoading() {
  return (
    <div className="space-y-4">
      <SkeletonDataTable rows={10} />
    </div>
  );
}
