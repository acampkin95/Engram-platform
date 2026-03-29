import type { Metadata } from 'next';
import CrawlerHomeContent from './CrawlerHomeContent';

export const metadata: Metadata = {
  title: 'Crawler | Engram Platform',
  description: 'Web crawler and OSINT management.',
};

export default function CrawlerHomePage() {
  return <CrawlerHomeContent />;
}
