// Server Component — no 'use client'.
// Renders the static shell; all interactive parts are in DashboardClient.

import type { ReactNode } from 'react';
import { DashboardClient } from './DashboardClient';

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex h-screen bg-[#03020a] overflow-hidden">
      <DashboardClient>{children}</DashboardClient>
    </div>
  );
}
