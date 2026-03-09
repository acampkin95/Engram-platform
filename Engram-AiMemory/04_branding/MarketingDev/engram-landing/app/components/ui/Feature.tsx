import { Card } from './Card';

interface FeatureProps {
  readonly title: string;
  readonly description: string;
  readonly icon?: React.ReactNode;
  readonly color?: 'amber' | 'violet' | 'teal';
  readonly className?: string;
}

export function Feature({ title, description, icon, color = 'violet', className }: FeatureProps) {
  return (
    <Card
      variant="default"
      className={`group relative overflow-hidden ${className}`}
    >
      {/* Background orb effect */}
      <div
        className={`
          absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16
          group-hover:scale-150 transition-transform duration-500
          ${color === 'amber' ? 'bg-[var(--engram-amber)]' : ''}
          ${color === 'violet' ? 'bg-[var(--engram-violet)]' : ''}
          ${color === 'teal' ? 'bg-[var(--engram-teal)]' : ''}
          opacity-5
        `}
      />

      <div className="relative">
        {icon && (
          <div className="w-12 h-12 mb-4 flex items-center justify-center">
            {icon}
          </div>
        )}

        <h3 className="font-[var(--font-display)] font-bold text-xl mb-3">
          {title}
        </h3>

        <p className="font-[var(--font-body)] text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
      </div>
    </Card>
  );
}
