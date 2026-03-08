import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    const helperId = helperText && !error && inputId ? `${inputId}-helper` : undefined;
    const describedBy = errorId || helperId || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-mute">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'w-full bg-void border text-text px-3.5 py-2.5',
              'font-mono text-xs outline-none',
              'transition-colors duration-150',
              'placeholder:text-text-mute',
              'focus:border-cyan focus:ring-2 focus:ring-cyan/10',
              error ? 'border-neon-r' : 'border-border',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-mute">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-neon-r">{error}</p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-xs text-text-dim">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export type { InputProps };
