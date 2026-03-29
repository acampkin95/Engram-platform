import type { Metadata } from 'next';
import AnalyticsContent from './AnalyticsContent';

export const metadata: Metadata = {
  title: 'Analytics | Engram Memory',
  description: 'Memory system analytics and insights.',
};

export default function MemoryAnalyticsPage() {
  return <AnalyticsContent />;
}
