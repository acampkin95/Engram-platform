import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion, slideUpVariants, easeDefault } from '../lib/motion';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  const prefersReduced = useReducedMotion();

  const Wrapper = prefersReduced ? 'div' : motion.div;
  const motionProps = prefersReduced
    ? {}
    : { variants: slideUpVariants, initial: 'hidden', animate: 'visible', transition: easeDefault };

  return (
    <Wrapper
      {...motionProps}
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}
    >
      {icon && (
        <div className="mb-4 text-text-mute" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-text-dim max-w-sm">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-3">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan hover:bg-cyan-dim text-void text-sm font-medium transition-colors"
            >
              {action.icon}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface hover:bg-raised text-text text-sm font-medium border border-border transition-colors"
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </Wrapper>
  );
}

interface EmptySearchResultsProps {
 query: string;
 onClear: () => void;
}

export function EmptySearchResults({ query, onClear }: EmptySearchResultsProps) {
 return (
 <EmptyState
 title={`No results for"${query}"`}
 description="Try adjusting your search or clearing the filters."
 action={{ label:'Clear search', onClick: onClear }}
 />
 );
}
