'use client';
import dynamic from 'next/dynamic';
import { LoadingState } from '@/src/design-system/components/LoadingState';

const ChatContent = dynamic(() => import('./ChatContent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <LoadingState label="Loading chat…" />
    </div>
  ),
});

export default function RAGChatPage() {
  return <ChatContent />;
}
