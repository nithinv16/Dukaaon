import React from 'react';
import { cn } from '@/lib/utils';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children: React.ReactNode;
}

const variantStyles = {
  h1: 'text-5xl md:text-6xl font-bold tracking-tight',
  h2: 'text-4xl md:text-5xl font-bold tracking-tight',
  h3: 'text-3xl md:text-4xl font-semibold',
  h4: 'text-2xl md:text-3xl font-semibold',
  h5: 'text-xl md:text-2xl font-medium',
  h6: 'text-lg md:text-xl font-medium',
};

export const Heading: React.FC<HeadingProps> = ({
  as = 'h2',
  variant,
  className,
  children,
  ...props
}) => {
  const Component = as;
  const variantClass = variantStyles[variant || as];

  return (
    <Component
      className={cn('font-heading text-primary-dark', variantClass, className)}
      {...props}
    >
      {children}
    </Component>
  );
};
