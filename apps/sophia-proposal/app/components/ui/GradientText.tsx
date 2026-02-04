import React from 'react';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  className = '',
  as: Component = 'span',
}) => {
  return (
    <Component className={`gradient-text ${className}`}>
      {children}
    </Component>
  );
};
