import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  glow = false,
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'font-heading font-semibold rounded-lg transition-all duration-300 inline-flex items-center justify-center';

  const variants = {
    primary: 'bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90',
    secondary: 'bg-secondary text-white hover:opacity-90',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-background',
    ghost: 'text-primary hover:bg-primary/10',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const glowClass = glow ? 'glow-primary' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${glowClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
