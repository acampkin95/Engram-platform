import { AlertTriangle } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/src/lib/utils';
import { Button } from './Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState = memo(function ErrorState({
  message = 'Something went wrong',
  onRetry,
  className,
}: Readonly<ErrorStateProps>) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in',
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 bg-[#FF6B6B]/20 blur-xl rounded-full" />
        <div className="relative w-14 h-14 rounded-2xl bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 flex items-center justify-center text-[#FF6B6B] shadow-inner">
          <AlertTriangle className="w-6 h-6" />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-[#f0eef8] mb-2">Error Occurred</h3>
      <div className="px-4 py-2 rounded-lg bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 max-w-sm mb-6">
        <p className="text-xs font-mono text-[#FF6B6B] break-words">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          className="hover:bg-[#FF6B6B]/10 hover:text-[#FF6B6B] hover:border-[#FF6B6B]/30 transition-colors"
        >
          Try Again
        </Button>
      )}
    </div>
  );
});
