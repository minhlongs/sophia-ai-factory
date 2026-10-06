import React from 'react';
import { cn } from '@/seed/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Badge content */
  children: React.ReactNode;
  /** Badge variant */
  variant?: 'solid' | 'outline' | 'soft';
  /** Color scheme */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'destructive' | 'neutral';
  /** Size */
  size?: 'sm' | 'md';
}

/**
 * Stitch-compatible Badge component
 *
 * Material Design 3 badge/chip styles with Sophia theme.
 */
export function Badge({
  children,
  variant = 'soft',
  color = 'primary',
  size = 'md',
  className = '',
  ...props
}: BadgeProps) {
  const baseStyles = cn(
    'inline-flex items-center gap-xs font-label-sm font-semibold rounded-full',
    'transition-colors duration-200'
  );

  const variants = {
    solid: '',
    outline: 'border',
    soft: '',
  };

  const colors = {
    primary: {
      solid: 'bg-primary text-on-primary',
      outline: 'border-primary text-primary-700 dark:text-primary-400',
      soft: 'bg-primary/10 text-primary-700 dark:text-primary-400 border border-primary/20',
    },
    secondary: {
      solid: 'bg-secondary text-on-secondary',
      outline: 'border-secondary text-secondary-700 dark:text-secondary-400',
      soft: 'bg-secondary/10 text-secondary-700 dark:text-secondary-400 border border-secondary/20',
    },
    success: {
      solid: 'bg-emerald-500 text-white',
      outline: 'border-emerald-500 text-emerald-700 dark:text-emerald-400',
      soft: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
    },
    warning: {
      solid: 'bg-amber-400 text-amber-950 font-semibold',
      outline: 'border-amber-500 text-amber-800 dark:text-amber-400',
      soft: 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20',
    },
    error: {
      solid: 'bg-destructive text-destructive-foreground',
      outline: 'border-rose-500 text-rose-700 dark:text-rose-400',
      soft: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
    },
    destructive: {
      solid: 'bg-destructive text-destructive-foreground',
      outline: 'border-rose-500 text-rose-700 dark:text-rose-400',
      soft: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
    },
    neutral: {
      solid: 'bg-surface-container-high text-on-surface',
      outline: 'border-outline-variant text-on-surface-variant',
      soft: 'bg-surface-container text-on-surface-variant',
    },
  };

  const sizesMap = {
    sm: 'px-xs py-0.5 text-[10px]',
    md: 'px-sm py-1 text-label-sm',
  };

  return (
    <span
      className={cn(
        baseStyles,
        sizesMap[size],
        variants[variant],
        colors[color][variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

Badge.displayName = 'Badge';
