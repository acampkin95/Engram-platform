import type { Metadata } from 'next';
import NotificationSettings from './NotificationSettings';

export const metadata: Metadata = {
  title: 'Settings | Engram System',
  description: 'System settings and configuration.',
};

export default function SystemSettingsPage() {
  return <NotificationSettings />;
}
