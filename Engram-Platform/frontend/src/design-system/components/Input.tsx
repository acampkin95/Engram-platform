import { InfoIcon } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, memo, type ReactNode } from 'react';
import { cn } from '@/src/lib/utils';
import { Tooltip } from './Tooltip';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  tooltip?: string;
  prefixIcon?: ReactNode;
  mono?: boolean;
}

export const Input = memo(
  forwardRef<HTMLInputElement, InputProps>(
    (
      { label, error, helpText, tooltip, prefixIcon, mono = false, className, id, ...props },
      ref,
    ) => {
      const inputId = id || label?.toLowerCase().replaceAll(/\s+/g, '-');

      return (
        <div className="flex flex-col gap-1.5">
          {label && (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor={inputId}
                className="text-xs font-medium text-[#a09bb8] uppercase tracking-wider font-mono"
              >
                {label}
              </label>
              {tooltip && (
                <Tooltip content={tooltip} side="right">
                  <InfoIcon className="w-3.5 h-3.5 text-[#8580a0] hover:text-[#a09bb8] transition-colors cursor-help" />
                </Tooltip>
              )}
            </div>
          )}
          <div className="relative">
            {prefixIcon && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8580a0]">
                {prefixIcon}
              </div>
            )}
            <input
              id={inputId}
              ref={ref}
              className={cn(
                'w-full bg-[#0d0d1a] border rounded-lg text-sm text-[#f0eef8] placeholder-[#8580a0]',
                'focus:outline-none focus:ring-1 transition-all duration-150',
                prefixIcon ? 'pl-9 pr-4 py-2' : 'px-4 py-2',
                error
                  ? 'border-[#FF6B6B]/40 focus:border-[#FF6B6B]/60 focus:ring-[#FF6B6B]/20'
                  : 'border-[#1e1e3a] focus:border-[#F2A93B]/40 focus:ring-[#F2A93B]/20',
                mono && 'font-mono',
                className,
              )}
              {...props}
            />
          </div>
          {error && <p className="text-xs text-[#FF6B6B]">{error}</p>}
          {helpText && !error && <p className="text-xs text-[#8580a0]">{helpText}</p>}
        </div>
      );
    },
  ),
);
Input.displayName = 'Input';
