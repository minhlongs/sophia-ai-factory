import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'primary' | 'secondary' | 'none';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  glow = 'none',
}) => {
  const baseStyles = 'glass rounded-xl p-6';
  const hoverStyles = hover ? 'glass-hover cursor-pointer' : '';
  const glowStyles = {
    primary: 'glow-primary',
    secondary: 'glow-secondary',
    none: '',
  };

  return (
    <div className={`${baseStyles} ${hoverStyles} ${glowStyles[glow]} ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={cn('flex flex-col space-y-1.5 p-6', className)}>{children}</div>;

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <h3 className={cn('text-2xl font-semibold leading-none tracking-tight', className)}>
    {children}
  </h3>
);

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={cn('p-6 pt-0', className)}>{children}</div>;
