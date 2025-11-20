import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, helperText, className, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-3 rounded-lg border font-body text-base',
            'transition-all duration-200 ease-in-out',
            'focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent',
            'disabled:bg-neutral-light disabled:cursor-not-allowed',
            error
              ? 'border-accent-red focus:ring-accent-red'
              : 'border-neutral-medium focus:ring-primary-orange',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-accent-red font-body">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-primary-gray font-body">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
