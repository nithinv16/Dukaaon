import React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  helperText?: string;
  showCharCount?: boolean;
  maxCharCount?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, helperText, showCharCount, maxCharCount, className, value, ...props }, ref) => {
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className="w-full">
        <textarea
          ref={ref}
          value={value}
          className={cn(
            'w-full px-4 py-3 rounded-lg border font-body text-base',
            'transition-all duration-200 ease-in-out resize-y',
            'focus:outline-none focus:ring-2 focus:ring-primary-orange focus:border-transparent',
            'disabled:bg-neutral-light disabled:cursor-not-allowed',
            error
              ? 'border-accent-red focus:ring-accent-red'
              : 'border-neutral-medium focus:ring-primary-orange',
            className
          )}
          {...props}
        />
        <div className="flex justify-between items-center mt-1">
          <div className="flex-1">
            {error && <p className="text-sm text-accent-red font-body">{error}</p>}
            {helperText && !error && (
              <p className="text-sm text-primary-gray font-body">{helperText}</p>
            )}
          </div>
          {showCharCount && maxCharCount && (
            <p
              className={cn(
                'text-sm font-body ml-2',
                currentLength > maxCharCount ? 'text-accent-red' : 'text-primary-gray'
              )}
            >
              {currentLength}/{maxCharCount}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
