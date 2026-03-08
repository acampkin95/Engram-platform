import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const describedBy = [
      error ? `${selectId}-error` : undefined,
      helperText && !error ? `${selectId}-helper` : undefined,
    ].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-text mb-2"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full bg-void border text-text px-3.5 py-2.5',
            'font-mono text-xs outline-none',
            'transition-colors duration-150',
            'focus:border-cyan focus:ring-2 focus:ring-cyan/10',
            'cursor-pointer appearance-none',
            'bg-no-repeat bg-right',
            error ? 'border-neon-r' : 'border-border',
            className
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%237a7a9a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundSize: '1.5rem',
            backgroundPosition: 'right 0.5rem center',
            paddingRight: '2.5rem',
          }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="mt-1.5 text-xs text-neon-r">{error}</p>
        )}
        {helperText && !error && (
          <p id={`${selectId}-helper`} className="mt-1.5 text-xs text-text-dim">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export type { SelectProps, SelectOption };
