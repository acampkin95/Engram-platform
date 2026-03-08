'use client';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { m } from 'framer-motion';
import { type ElementType, memo } from 'react';
import { cn } from '@/src/lib/utils';

export interface Tab {
  id: string;
  label: string;
  icon?: ElementType;
}

interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'solid' | 'underline';
}

export const Tabs = memo(function Tabs({
  tabs,
  activeId,
  onChange,
  className,
  variant = 'solid',
}: Readonly<TabsProps>) {
  if (variant === 'underline') {
    return (
      <TabsPrimitive.Root value={activeId} onValueChange={onChange}>
        <TabsPrimitive.List
          className={cn('flex items-center gap-6 border-b border-[#1e1e3a]', className)}
        >
          {tabs.map((tab) => {
            const isActive = activeId === tab.id;
            return (
              <TabsPrimitive.Trigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A93B]/50 rounded-t-sm',
                  isActive ? 'text-[#F2A93B]' : 'text-[#a09bb8] hover:text-[#f0eef8]',
                )}
              >
                {tab.icon && <tab.icon className="w-4 h-4" />}
                {tab.label}
                {isActive && (
                  <m.div
                    layoutId="underline-active-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F2A93B] shadow-[0_0_8px_rgba(242,169,59,0.6)]"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </TabsPrimitive.Trigger>
            );
          })}
        </TabsPrimitive.List>
      </TabsPrimitive.Root>
    );
  }

  // Solid variant
  return (
    <TabsPrimitive.Root value={activeId} onValueChange={onChange}>
      <TabsPrimitive.List
        className={cn(
          'inline-flex items-center gap-1 p-1 rounded-lg bg-[#0d0d1a] border border-[#1e1e3a]',
          className,
        )}
      >
        {tabs.map((tab) => {
          const isActive = activeId === tab.id;
          return (
            <TabsPrimitive.Trigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors relative flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2A93B]/50',
                isActive ? 'text-[#03020a]' : 'text-[#a09bb8] hover:text-[#f0eef8]',
              )}
            >
              {isActive && (
                <m.div
                  layoutId="solid-active-tab"
                  className="absolute inset-0 bg-[#F2A93B] rounded-md shadow-[0_0_12px_rgba(242,169,59,0.3)]"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {tab.icon && <tab.icon className="w-4 h-4" />}
                {tab.label}
              </span>
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
});

export const TabsContent = TabsPrimitive.Content;
