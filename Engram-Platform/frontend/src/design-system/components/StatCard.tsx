import { TrendingDown, TrendingUp } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number; // positive = up, negative = down
  trendLabel?: string;
  icon?: ReactNode;
  accent?: 'amber' | 'purple' | 'teal' | 'rose' | 'blue';
  className?: string;
}

const accents = {
  amber: {
    text: 'text-[#F2A93B]',
    bg: 'bg-[#F2A93B]/10',
    border: 'border-[#F2A93B]/20',
    iconBg: 'bg-[#F2A93B]/20',
    iconColor: 'text-[#F2A93B]',
    glow: 'group-hover:shadow-[0_0_15px_rgba(242,169,59,0.15)]',
  },
  purple: {
    text: 'text-[#9B7DE0]',
    bg: 'bg-[#9B7DE0]/10',
    border: 'border-[#9B7DE0]/20',
    iconBg: 'bg-[#9B7DE0]/20',
    iconColor: 'text-[#9B7DE0]',
    glow: 'group-hover:shadow-[0_0_15px_rgba(155,125,224,0.15)]',
  },
  teal: {
    text: 'text-[#2EC4C4]',
    bg: 'bg-[#2EC4C4]/10',
    border: 'border-[#2EC4C4]/20',
    iconBg: 'bg-[#2EC4C4]/20',
    iconColor: 'text-[#2EC4C4]',
    glow: 'group-hover:shadow-[0_0_15px_rgba(46,196,196,0.15)]',
  },
  rose: {
    text: 'text-[#E07D9B]',
    bg: 'bg-[#E07D9B]/10',
    border: 'border-[#E07D9B]/20',
    iconBg: 'bg-[#E07D9B]/20',
    iconColor: 'text-[#E07D9B]',
    glow: 'group-hover:shadow-[0_0_15px_rgba(224,125,155,0.15)]',
  },
  blue: {
    text: 'text-[#7D9BE0]',
    bg: 'bg-[#7D9BE0]/10',
    border: 'border-[#7D9BE0]/20',
    iconBg: 'bg-[#7D9BE0]/20',
    iconColor: 'text-[#7D9BE0]',
    glow: 'group-hover:shadow-[0_0_15px_rgba(125,155,224,0.15)]',
  },
};

export const StatCard = memo(function StatCard({
  label,
  value,
  trend,
  trendLabel,
  icon,
  accent = 'amber',
  className,
}: StatCardProps) {
  const a = accents[accent];
  return (
    <div
      className={cn(
        'group relative rounded-xl p-5 border transition-all duration-300 overflow-hidden',
        'hover:-translate-y-1',
        a.bg,
        a.border,
        a.glow,
        className,
      )}
      data-testid="stat-card"
    >
      {/* Decorative gradient orb */}
      <div
        className={cn(
          'absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 transition-opacity duration-300 group-hover:opacity-40',
          a.iconBg.replace('/20', ''),
        )}
      />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-xs text-[#a09bb8] font-mono uppercase tracking-wider mb-1.5 transition-colors group-hover:text-[#f0eef8]">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <p className={cn('text-3xl font-bold tracking-tight', a.text)}>{value}</p>
            {trend !== undefined && (
              <div
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium mt-1.5',
                  trend >= 0 ? 'bg-[#2EC4C4]/10 text-[#2EC4C4]' : 'bg-[#FF6B6B]/10 text-[#FF6B6B]',
                )}
              >
                {trend >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{Math.abs(trend)}%</span>
              </div>
            )}
          </div>
          {trendLabel && <p className="text-[11px] text-[#5c5878] mt-1">{trendLabel}</p>}
        </div>

        {icon && (
          <div
            className={cn(
              'p-2.5 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110',
              a.iconBg,
              a.iconColor,
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
});
