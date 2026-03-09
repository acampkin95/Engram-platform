"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const tabs = [
  { href: "/dashboard/analytics/memories", label: "Memories" },
  { href: "/dashboard/analytics/search", label: "Search" },
  { href: "/dashboard/analytics/system", label: "System" },
];

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              pathname === tab.href
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-[#5C5878] hover:text-[#A09BB8]"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
