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
  padding = 'md',
  hoverable = false,
  className = '',
  ...props
}: CardProps) {
  const baseStyles = cn(
    'bg-card dark:bg-[#11131F] border border-border dark:border-white/[0.08] rounded-2xl',
    'shadow-sm dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]',
    'transition-all duration-300'
  );

  const variants = {
    elevated: '',
    outlined: 'border border-border dark:border-white/[0.08]',
    filled: 'bg-muted dark:bg-[#0D0F19]',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  };

  const hoverStyles = hoverable
    ? 'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:hover:shadow-[0_8px_30px_-8px_rgba(99,102,241,0.2)]'
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
