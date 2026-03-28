'use client';
import dynamic from 'next/dynamic';
import { LoadingState } from '@/src/design-system/components/LoadingState';

const CanvasContent = dynamic(() => import('./CanvasContent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <LoadingState label="Initializing canvas workspace…" />
    </div>
  ),
});

export default function CanvasWorkspacePage() {
  return <CanvasContent />;
}
