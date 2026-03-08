'use client';
import dynamic from 'next/dynamic';
import { LoadingState } from '@/src/design-system/components/LoadingState';

const CrawlerKnowledgeGraphContent = dynamic(() => import('./CrawlerKnowledgeGraphContent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <LoadingState label="Loading knowledge graph\u2026" />
    </div>
  ),
});

export default function CrawlerKnowledgeGraphPage() {
  return <CrawlerKnowledgeGraphContent />;
}
