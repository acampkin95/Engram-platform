import type { Metadata } from 'next';
import CrawlContent from './CrawlContent';

export const metadata: Metadata = {
  title: 'Crawl | Engram Crawler',
  description: 'Web crawling and content extraction.',
};

export default function CrawlPage() {
  return <CrawlContent />;
}
