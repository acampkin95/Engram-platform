import type { Metadata } from 'next';
import IntelligenceInvestigationsContent from './IntelligenceInvestigationsContent';

export const metadata: Metadata = {
  title: 'Investigations | Engram Intelligence',
  description: 'Intelligence investigations and analysis.',
};

export default function IntelligenceInvestigationsPage() {
  return <IntelligenceInvestigationsContent />;
}
