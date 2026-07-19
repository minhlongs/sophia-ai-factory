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
    // Saigon Factory — letterpress bordered card replaces generic shadow
    'bg-surface-container-lowest rounded-lg border border-outline-variant',
    'shadow-[inset_0_1px_0_0_hsl(var(--border)),0_1px_3px_0_rgba(0,0,0,0.06)]',
    'transition-all duration-200'
  );

  const variants = {
    elevated: '',  // letterpress is the default now
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
    ? 'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.3),0_6px_20px_rgba(0,0,0,0.1)]'
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
