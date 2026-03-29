import type { Metadata } from 'next';
import MemoryHomeContent from './MemoryHomeContent';

export const metadata: Metadata = {
  title: 'Memory | Engram Platform',
  description: 'Memory system overview and management.',
};

export default function MemoryHomePage() {
  return <MemoryHomeContent />;
}
