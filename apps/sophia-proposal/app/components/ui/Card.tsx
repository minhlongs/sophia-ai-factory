import React from 'react';

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
