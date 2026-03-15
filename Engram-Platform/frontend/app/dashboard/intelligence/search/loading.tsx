import { SkeletonDataTable, SkeletonFilterBar } from '@/src/components/Skeletons';

export default function SearchLoading() {
  return (
    <div className="space-y-4">
      <SkeletonFilterBar />
      <SkeletonDataTable rows={8} />
    </div>
  );
}
