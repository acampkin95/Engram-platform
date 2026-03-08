import { type LucideIcon } from 'lucide-react';
import { FaArrowTrendUp, FaArrowTrendDown, FaMinus } from 'react-icons/fa6';
import { motion } from 'framer-motion';
import { useReducedMotion, staggerItem, glowHover } from '../../lib/motion';

export interface StatCardData {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
}

interface StatCardProps {
  stat: StatCardData;
}

export function StatCard({ stat }: StatCardProps) {
  const prefersReduced = useReducedMotion();
  const Icon = stat.icon;

  return (
    <motion.div
      variants={prefersReduced ? undefined : staggerItem}
      whileHover={prefersReduced ? undefined : glowHover}
      className="group bg-surface p-6 border border-border hover:border-cyan/30 transition-all duration-300 hover:shadow-cyan/5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 ${stat.bg} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-6 h-6 ${stat.color}`} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {stat.sub && (
            <span className="text-xs text-text-dim font-medium">
              {stat.sub}
            </span>
          )}
          {stat.trend && (
            <TrendIndicator trend={stat.trend} />
          )}
        </div>
      </div>
      <div>
        <p className="text-3xl font-display font-bold text-text mb-1 group-hover:text-cyan transition-colors">
          {stat.value}
        </p>
        <p className="text-sm text-text-dim font-medium">
          {stat.label}
        </p>
      </div>
    </motion.div>
  );
}

function TrendIndicator({ trend }: { trend: StatCardData['trend'] }) {
  if (!trend) return null;

  const colorMap = {
    up: 'text-plasma',
    down: 'text-neon-r',
    neutral: 'text-text-mute',
  };

  if (trend.direction === 'up') {
    return (
      <span className={`flex items-center gap-1 text-xs font-medium ${colorMap.up}`}>
        <FaArrowTrendUp size={12} />
        {trend.value > 0 ? `${trend.value}%` : '—'}
      </span>
    );
  }

  if (trend.direction === 'down') {
    return (
      <span className={`flex items-center gap-1 text-xs font-medium ${colorMap.down}`}>
        <FaArrowTrendDown size={12} />
        {trend.value > 0 ? `${trend.value}%` : '—'}
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${colorMap.neutral}`}>
      <FaMinus size={12} />
      {trend.value > 0 ? `${trend.value}%` : '—'}
    </span>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-surface p-6 border border-border animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-abyss/50" />
        <div className="w-16 h-6 rounded-full bg-abyss/50" />
      </div>
      <div className="w-16 h-8 bg-abyss/50 mb-2" />
      <div className="w-24 h-4 bg-abyss" />
    </div>
  );
}

interface StatCardGridProps {
  cards: StatCardData[];
  loading?: boolean;
}

export function StatCardGrid({ cards, loading }: StatCardGridProps) {
  const prefersReduced = useReducedMotion();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      variants={prefersReduced ? undefined : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.05 },
        },
      }}
      initial={prefersReduced ? undefined : 'hidden'}
      animate={prefersReduced ? undefined : 'visible'}
    >
      {cards.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </motion.div>
  );
}
