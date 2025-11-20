import React from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  error?: boolean;
  children: React.ReactNode;
}

export const Label: React.FC<LabelProps> = ({
  required = false,
  error = false,
  className,
  children,
  ...props
}) => {
  return (
    <label
      className={cn(
        'font-body text-sm font-medium',
        error ? 'text-accent-red' : 'text-primary-dark',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-accent-red">*</span>}
    </label>
  );
};
