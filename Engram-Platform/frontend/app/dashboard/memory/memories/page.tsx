import type { Metadata } from 'next';
import MemoriesContent from './MemoriesContent';

export const metadata: Metadata = {
  title: 'Memories | Engram Memory',
  description: 'Browse and manage memories.',
};

export default function MemoriesPage() {
  return <MemoriesContent />;
}
