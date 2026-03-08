'use client';
import dynamic from 'next/dynamic';
import { LoadingState } from '@/src/design-system/components/LoadingState';

const MemoryGraphContent = dynamic(() => import('./MemoryGraphContent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <LoadingState label="Loading graph…" />
    </div>
  ),
});

export default function MemoryGraphPage() {
  return <MemoryGraphContent />;
}
