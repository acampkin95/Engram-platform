import type { Metadata } from 'next';
import TimelineContent from './TimelineContent';

export const metadata: Metadata = {
  title: 'Timeline | Engram Memory',
  description: 'Chronological timeline of extracted events.',
};

export default function TimelinePage() {
  return <TimelineContent />;
}
