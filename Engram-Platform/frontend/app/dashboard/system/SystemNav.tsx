'use client';

import { Activity, Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'System Health', href: '/dashboard/system/health', icon: Activity },
  { label: 'Alert Settings', href: '/dashboard/system/settings', icon: Bell },
] as const;

export default function SystemNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[#222633]/60">
      <div className="flex items-end gap-1 px-6 pt-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-xs font-mono uppercase tracking-widest transition-colors ${
                isActive
                  ? 'border-[#f2a93b] bg-[#13151c]/60 text-[#f0eef8]'
                  : 'border-transparent text-[#5c5878] hover:text-[#a09bb8]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
