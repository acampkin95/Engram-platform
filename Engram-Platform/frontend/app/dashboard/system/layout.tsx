import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { requireAdminAccess } from '@/src/server/admin-access';
import SystemNav from './SystemNav';

export default async function SystemDashboardLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdminAccess();
  } catch {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-0 flex-col">
      <SystemNav />
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
