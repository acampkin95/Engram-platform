import type { Metadata } from 'next';
import SearchContent from './SearchContent';

export const metadata: Metadata = {
  title: 'Search | Engram Intelligence',
  description: 'Search and query intelligence data.',
};

export default function SearchPage() {
  return <SearchContent />;
}
