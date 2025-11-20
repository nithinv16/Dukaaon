import React from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  error?: string;
  helperText?: string;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, error, helperText, placeholder, className, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full px-4 py-3 rounded-lg border font-body text-base appearance-none',
              'transition-all duration-200 ease-in-out',
              'focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent',
              'disabled:bg-neutral-light disabled:cursor-not-allowed',
              'bg-neutral-white cursor-pointer',
              error
                ? 'border-accent-red focus:ring-accent-red'
                : 'border-neutral-medium focus:ring-primary-orange',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {/* Custom dropdown arrow */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-primary-gray">
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
        {error && <p className="mt-1 text-sm text-accent-red font-body">{error}</p>}
        {helperText && !error && (
          <p className="mt-1 text-sm text-primary-gray font-body">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
