import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = 'md',
  message,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const content = (
    <div
      className="flex flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <Loader2 className={`${sizeClasses[size]} animate-spin text-cyan`} aria-hidden="true" />
      <span className={message ? 'text-sm text-text-mute' : 'sr-only'}>
        {message ?? 'Loading\u2026'}
      </span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-void/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}
