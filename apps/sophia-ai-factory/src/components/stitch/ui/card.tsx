import React from 'react';
import { cn } from '@/seed/utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card content */
  children: React.ReactNode;
  /** Card variant */
  variant?: 'elevated' | 'outlined' | 'filled';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether card has hover effects */
  hoverable?: boolean;
}

/**
 * Stitch-compatible Card component
 *
 * Matches Material Design 3 card styles with Sophia theme.
 */
export function Card({
  children,
  variant = 'elevated',
  padding = 'lg',
  hoverable = false,
  className = '',
  ...props
}: CardProps) {
  const baseStyles = cn(
    'bg-surface-container-lowest rounded-xl border border-outline-variant',
    'transition-all duration-200'
  );

  const variants = {
    elevated: 'custom-shadow-md',
    outlined: 'border-2',
    filled: 'bg-surface-container',
  };

  const paddings = {
    none: '',
    sm: 'p-sm',
    md: 'p-md',
    lg: 'p-lg',
    xl: 'p-xl',
  };

  const hoverStyles = hoverable
    ? 'hover:-translate-y-0.5 hover:border-primary hover:shadow-lg'
    : '';

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        paddings[padding],
        hoverStyles,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardHeader({ children, className = '', ...props }: CardHeaderProps) {
  return (
    <div className={cn('mb-lg', className)} {...props}>
      {children}
    </div>
  );
}

CardHeader.displayName = 'CardHeader';

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardContent({ children, className = '', ...props }: CardContentProps) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

CardContent.displayName = 'CardContent';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardFooter({ children, className = '', ...props }: CardFooterProps) {
  return (
    <div
      className={cn('mt-lg pt-lg border-t border-outline-variant flex items-center', className)}
      {...props}
    >
      {children}
    </div>
  );
}

CardFooter.displayName = 'CardFooter';
