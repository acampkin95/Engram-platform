import { SkeletonDataTable, SkeletonFilterBar } from '@/src/components/Skeletons';

export default function InvestigationsLoading() {
  return (
    <div className="space-y-4">
      <SkeletonFilterBar />
      <SkeletonDataTable rows={6} />
    </div>
  );
}
