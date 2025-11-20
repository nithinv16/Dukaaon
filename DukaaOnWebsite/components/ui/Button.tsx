import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  asChild?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary:
    'bg-primary-orange text-neutral-white hover:bg-opacity-90 active:bg-opacity-80 shadow-md hover:shadow-lg',
  secondary:
    'bg-secondary-blue text-neutral-white hover:bg-opacity-90 active:bg-opacity-80 shadow-md hover:shadow-lg',
  outline:
    'bg-transparent border-2 border-primary-orange text-primary-orange hover:bg-primary-orange hover:text-neutral-white',
};

const sizeStyles = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  asChild = false,
  disabled,
  className,
  children,
  ...props
}) => {
  const classes = cn(
    'font-body font-medium rounded-lg transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-primary-orange focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variantStyles[variant],
    sizeStyles[size],
    className
  );

  if (asChild) {
    return React.cloneElement(children as React.ReactElement, {
      className: cn((children as React.ReactElement).props.className, classes),
    });
  }

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
};
