import React from 'react';
import { cn } from '@/lib/utils';

export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  as?: 'p' | 'span' | 'div';
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'muted' | 'accent';
  children: React.ReactNode;
}

const sizeStyles = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const weightStyles = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const colorStyles = {
  primary: 'text-primary-dark',
  secondary: 'text-primary-gray',
  muted: 'text-neutral-medium',
  accent: 'text-primary-orange',
};

export const Text: React.FC<TextProps> = ({
  as = 'p',
  size = 'base',
  weight = 'normal',
  color = 'primary',
  className,
  children,
  ...props
}) => {
  const Component = as;

  return (
    <Component
      className={cn(
        'font-body',
        sizeStyles[size],
        weightStyles[weight],
        colorStyles[color],
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
};
