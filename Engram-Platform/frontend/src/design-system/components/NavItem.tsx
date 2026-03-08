'use client';
import { m } from 'framer-motion';
import Link from 'next/link';
import { type ElementType, memo } from 'react';
import { cn } from '@/src/lib/utils';

type SystemSection = 'crawler' | 'memory' | 'intelligence';

interface NavItemProps {
  href: string;
  label: string;
  icon: ElementType;
  isActive: boolean;
  section?: SystemSection;
  collapsed?: boolean;
}

const sectionActiveColors = {
  crawler: 'text-[#9B7DE0] bg-[#9B7DE0]/10',
  memory: 'text-[#2EC4C4] bg-[#2EC4C4]/10',
  intelligence: 'text-[#F2A93B] bg-[#F2A93B]/10',
};

const sectionIconColors = {
  crawler: 'text-[#9B7DE0]',
  memory: 'text-[#2EC4C4]',
  intelligence: 'text-[#F2A93B]',
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
    <Link href={href} title={collapsed ? label : undefined}>
      <m.div
        whileHover={{ x: isActive ? 0 : 2 }}
        transition={{ duration: 0.12 }}
        className={cn(
          'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 relative',
          collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5',
          isActive
            ? sectionActiveColors[section]
            : 'text-[#5c5878] hover:text-[#f0eef8] hover:bg-[#1e1e3a]/50',
        )}
      >
        <Icon
          className={cn(
            'w-4 h-4 flex-shrink-0',
            isActive ? sectionIconColors[section] : 'text-[#5c5878]',
          )}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </m.div>
    </Link>
  );
});
