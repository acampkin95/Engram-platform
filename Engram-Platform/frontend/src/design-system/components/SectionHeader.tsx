import { memo, type ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

interface SectionHeaderProps {
  title: string;
  breadcrumb?: string[];
  action?: ReactNode;
  className?: string;
}

export const SectionHeader = memo(function SectionHeader({
  title,
  breadcrumb,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-6', className)}>
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <p className="text-xs text-[#5c5878] font-mono uppercase tracking-wider mb-1">
            {breadcrumb.join(' / ')}
          </p>
        )}
        <h1 className="text-xl font-semibold text-[#f0eef8]">{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
});
