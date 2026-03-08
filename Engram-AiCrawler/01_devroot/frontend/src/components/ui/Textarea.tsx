import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error && textareaId ? `${textareaId}-error` : undefined;
    const helperId = helperText && !error && textareaId ? `${textareaId}-helper` : undefined;
    const describedBy = errorId || helperId || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-text mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full bg-void border text-text px-3.5 py-2.5',
            'font-mono text-xs outline-none',
            'transition-colors duration-150',
            'placeholder:text-text-mute',
            'focus:border-cyan focus:ring-2 focus:ring-cyan/10',
            'resize-y min-h-[100px]',
            error ? 'border-neon-r' : 'border-border',
            className
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea';

export type { TextareaProps };
