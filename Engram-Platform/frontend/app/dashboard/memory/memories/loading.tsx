import { SkeletonFilterBar, SkeletonDataTable } from '@/src/components/Skeletons';

export default function MemoriesLoading() {
  return (
    <div className="space-y-4">
      <SkeletonFilterBar />
      <SkeletonDataTable rows={10} />
    </div>
  );
}
