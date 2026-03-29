import type { Metadata } from 'next';
import InvestigationsContent from './InvestigationsContent';

export const metadata: Metadata = {
  title: 'Investigations | Engram Crawler',
  description: 'Crawler investigations and results.',
};

export default function InvestigationsPage() {
  return <InvestigationsContent />;
}
