'use client';
import { m } from 'framer-motion';
import Link from 'next/link';
import { type ElementType, memo } from 'react';
import { cn } from '@/src/lib/utils';

type SystemSection = 'crawler' | 'memory' | 'intelligence' | 'admin';

interface NavItemProps {
  href: string;
  label: string;
  icon: ElementType;
  isActive: boolean;
  section?: SystemSection;
  collapsed?: boolean;
}

const sectionActiveColors: Record<SystemSection, string> = {
  crawler: 'text-[var(--color-violet-bright)] bg-[var(--color-violet-bright)]/10',
  memory: 'text-[var(--color-teal)] bg-[var(--color-teal)]/10',
  intelligence: 'text-[var(--color-amber)] bg-[var(--color-amber)]/10',
  admin: 'text-[var(--color-rose)] bg-[var(--color-rose)]/10',
};

const sectionIconColors: Record<SystemSection, string> = {
  crawler: 'text-[var(--color-violet-bright)]',
  memory: 'text-[var(--color-teal)]',
  intelligence: 'text-[var(--color-amber)]',
  admin: 'text-[var(--color-rose)]',
};

export const NavItem = memo(function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  section = 'intelligence',
  collapsed = false,
}: NavItemProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      <m.div
        whileHover={{ x: isActive ? 0 : 2 }}
        transition={{ duration: 0.12 }}
        className={cn(
          'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 relative',
          collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5',
          isActive
            ? sectionActiveColors[section]
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/[0.04]',
        )}
      >
        <Icon
          className={cn(
            'w-4 h-4 flex-shrink-0',
            isActive ? sectionIconColors[section] : 'text-[var(--color-text-muted)]',
          )}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </m.div>
    </Link>
  );
});
