'use client';
import dynamic from 'next/dynamic';
import { LoadingState } from '@/src/design-system/components/LoadingState';

const KnowledgeGraphContent = dynamic(() => import('./KnowledgeGraphContent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <LoadingState label="Loading knowledge graph…" />
    </div>
  ),
});

export default function UnifiedKnowledgeGraphPage() {
  return <KnowledgeGraphContent />;
}
