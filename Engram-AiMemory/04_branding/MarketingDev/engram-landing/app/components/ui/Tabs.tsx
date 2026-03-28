'use client';

import { HTMLAttributes } from 'react';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  ...props
}: TabsProps) {
  return (
    <div
      className={`flex gap-1 p-1 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] overflow-x-auto ${className || ''}`}
      {...props}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-md font-[var(--font-mono)] text-xs font-semibold uppercase tracking-wider transition-all duration-300 whitespace-nowrap
            ${
              activeTab === tab.id
                ? 'bg-[var(--engram-amber)] text-[var(--void)] shadow-lg'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
            }
          `}
          type="button"
          aria-pressed={activeTab === tab.id}
        >
          {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
