import type { Metadata } from 'next';
import MattersContent from './MattersContent';

export const metadata: Metadata = {
  title: 'Matters | Engram Memory',
  description: 'Legal matters and case management.',
};

export default function MattersPage() {
  return <MattersContent />;
}
