import { Inbox } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  variant?: 'default' | 'card' | 'inline';
  context?: 'memory' | 'crawler' | 'search' | 'matter' | 'investigation';
}

export const EmptyState = memo(function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  variant = 'default',
  context,
}: Readonly<EmptyStateProps>) {
  const containerStyles = {
    default: 'py-16 px-4',
    card: 'py-12 px-6 bg-[#0d0d1a] border border-[#1e1e3a] rounded-xl',
    inline: 'py-8 px-4',
  };

  const contextHints: Record<
    NonNullable<EmptyStateProps['context']>,
    { hint: string; step: string }
  > = {
    memory: {
      hint: 'Add memories manually or let the crawler discover them',
      step: '1 of 2',
    },
    crawler: {
      hint: 'Configure a crawl target to start discovering content',
      step: '1 of 2',
    },
    search: {
      hint: 'Try broadening your search terms or check your spelling',
      step: '1 of 1',
    },
    matter: {
      hint: 'Create a matter to group related memories together',
      step: '1 of 2',
    },
    investigation: {
      hint: 'Start an investigation to build a comprehensive intelligence report',
      step: '1 of 2',
    },
  };

  const ctx = context ? contextHints[context] : null;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center animate-fade-in',
        containerStyles[variant],
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#1e1e3a]/30 flex items-center justify-center mb-5 text-[#8580a0] shadow-inner">
        {icon ?? <Inbox className="w-6 h-6 opacity-60" />}
      </div>
      <h3 className="text-sm font-medium text-[#f0eef8] mb-1.5">{title}</h3>
      {description && (
        <p className="text-xs text-[#a09bb8] max-w-xs mb-4 leading-relaxed">{description}</p>
      )}
      {ctx && (
        <p className="text-[10px] text-[#3a3850] font-mono mb-6">
          {ctx.step} — {ctx.hint}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
});
