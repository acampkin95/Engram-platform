import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { requireAdminAccess } from '@/src/server/admin-access';

export default async function SystemDashboardLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdminAccess();
  } catch {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
