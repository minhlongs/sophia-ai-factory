import React from 'react';
import { cn } from '@/seed/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Badge content */
  children: React.ReactNode;
  /** Badge variant */
  variant?: 'solid' | 'outline' | 'soft';
  /** Color scheme */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';
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
      outline: 'border-primary text-primary',
      soft: 'bg-primary/10 text-primary border border-primary/20',
    },
    secondary: {
      solid: 'bg-secondary text-on-secondary',
      outline: 'border-secondary text-secondary',
      soft: 'bg-secondary/10 text-secondary border border-secondary/20',
    },
    success: {
      solid: 'bg-emerald-500 text-white',
      outline: 'border-emerald-500 text-emerald-600',
      soft: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    },
    warning: {
      solid: 'bg-amber-500 text-white',
      outline: 'border-amber-500 text-amber-600',
      soft: 'bg-amber-50 text-amber-700 border border-amber-100',
    },
    error: {
      solid: 'bg-destructive text-destructive-foreground',
      outline: 'border-destructive text-destructive',
      soft: 'bg-destructive/10 text-destructive border border-destructive/20',
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
        variants[variant],
        colors[color][variant],
        sizesMap[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

Badge.displayName = 'Badge';
