import type { Metadata } from 'next';
import AuditContent from './AuditContent';

export const metadata: Metadata = {
  title: 'Audit Log | Engram System',
  description: 'View API request audit logs and analytics.',
};

export default function AuditLogPage() {
  return <AuditContent />;
}
