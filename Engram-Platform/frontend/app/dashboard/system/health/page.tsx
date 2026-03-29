import type { Metadata } from 'next';
import SystemHealthContent from './SystemHealthContent';

export const metadata: Metadata = {
  title: 'Health | Engram System',
  description: 'System health monitoring and status.',
};

export default function SystemHealthPage() {
  return <SystemHealthContent />;
}
