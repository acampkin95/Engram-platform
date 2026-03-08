'use client';
import { AnimatePresence, m } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { memo, type ReactNode, useState } from 'react';
import { cn } from '@/src/lib/utils';

interface SidebarGroupProps {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export const SidebarGroup = memo(function SidebarGroup({
  label,
  children,
  defaultOpen = true,
  className,
}: SidebarGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] text-[#5c5878] uppercase tracking-widest font-mono hover:text-[#a09bb8] transition-colors"
      >
        {label}
        <ChevronDown
          className={cn(
            'w-3 h-3 transition-transform duration-200',
            open ? 'rotate-0' : '-rotate-90',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 pb-2">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
});
