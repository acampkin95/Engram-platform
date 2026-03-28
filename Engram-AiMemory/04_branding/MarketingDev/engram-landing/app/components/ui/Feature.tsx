import Link from 'next/link';
import { Card } from './Card';

interface FeatureProps {
  readonly title: string;
  readonly description: string;
  readonly icon?: React.ReactNode;
  readonly color?: 'amber' | 'violet' | 'teal' | 'rose';
  readonly size?: 'default' | 'large';
  readonly href?: string;
  readonly badge?: string;
  readonly className?: string;
}

const getColorClass = (
  color: string,
  type: 'bg' | 'border' = 'bg'
): string => {
  const mapping: Record<'bg' | 'border', Record<string, string>> = {
    bg: {
      amber: 'bg-[var(--engram-amber)]',
      violet: 'bg-[var(--engram-violet)]',
      teal: 'bg-[var(--engram-teal)]',
      rose: 'bg-[var(--engram-rose)]',
    },
    border: {
      amber: 'border-[var(--border-amber)]',
      violet: 'border-[var(--border-violet)]',
      teal: 'border-[var(--border-teal)]',
      rose: 'border-[var(--border-rose)]',
    },
  };
  const typeMap = mapping[type] as Record<string, string>;
  return typeMap[color] || typeMap.violet;
};

export function Feature({
  title,
  description,
  icon,
  color = 'violet',
  size = 'default',
  href,
  badge,
  className,
}: FeatureProps) {
  const isLarge = size === 'large';
  const padding = isLarge ? 'p-8' : 'p-6';
  const content = (
    <Card
      variant="default"
      className={`group relative overflow-hidden transition-all duration-300 ${
        href ? 'cursor-pointer hover:shadow-lg' : ''
      } ${className}`}
      padding="none"
    >
      {/* Background orb effect */}
      <div
        className={`
          absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16
          group-hover:scale-150 transition-transform duration-500
          ${color === 'amber' ? 'bg-[var(--engram-amber)]' : ''}
          ${color === 'violet' ? 'bg-[var(--engram-violet)]' : ''}
          ${color === 'teal' ? 'bg-[var(--engram-teal)]' : ''}
          ${color === 'rose' ? 'bg-[var(--engram-rose)]' : ''}
          opacity-5
        `}
      />

      <div className={`relative ${padding}`}>
        {badge && (
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
            <span className="font-[var(--font-mono)] text-xs text-[var(--text-muted)] uppercase tracking-[0.1em]">
              {badge}
            </span>
          </div>
        )}

        {icon && (
          <div className={`mb-4 flex items-center justify-center ${isLarge ? 'w-16 h-16' : 'w-12 h-12'}`}>
            {icon}
          </div>
        )}

        <h3
          className={`font-[var(--font-display)] font-bold mb-3 ${
            isLarge ? 'text-2xl' : 'text-xl'
          }`}
        >
          {title}
        </h3>

        <p
          className={`font-[var(--font-body)] text-[var(--text-secondary)] leading-relaxed ${
            isLarge ? 'text-lg' : ''
          }`}
        >
          {description}
        </p>
      </div>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
