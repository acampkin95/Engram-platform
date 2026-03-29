import type { Metadata } from 'next';
import OsintContent from './OsintContent';

export const metadata: Metadata = {
  title: 'OSINT | Engram Crawler',
  description: 'Open-source intelligence data collection.',
};

export default function OsintPage() {
  return <OsintContent />;
}
