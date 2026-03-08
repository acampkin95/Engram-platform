import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/src/lib/utils';

const tagVariants = cva(
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#1e1e3a]/50 border border-[#1e1e3a] text-[#a09bb8] hover:bg-[#1e1e3a]',
        active: 'bg-[#F2A93B]/10 border border-[#F2A93B]/20 text-[#F2A93B]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface TagProps extends VariantProps<typeof tagVariants> {
  label: string;
  onRemove?: () => void;
  className?: string;
}

export const Tag = memo(function Tag({ label, variant, onRemove, className }: Readonly<TagProps>) {
  return (
    <span className={cn(tagVariants({ variant, className }))}>
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-[#5c5878] hover:text-[#f0eef8] transition-colors ml-0.5"
          aria-label={`Remove ${label} tag`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
});
