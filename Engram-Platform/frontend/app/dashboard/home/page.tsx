import type { Metadata } from 'next';
import HomeContent from './HomeContent';

export const metadata: Metadata = {
  title: 'Home | Engram Platform',
  description: 'Dashboard home overview.',
};

export default function HomePage() {
  return <HomeContent />;
}
