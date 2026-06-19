import React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: React.ReactNode;
  /** Button variant style */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Left icon */
  iconLeft?: React.ReactNode;
  /** Right icon */
  iconRight?: React.ReactNode;
  /** URL to link to (renders as <a> if provided) */
  href?: string;
}

/**
 * Stitch-compatible Button component
 *
 * Maps to Material Design 3 button styles with Sophia theme integration.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  iconLeft,
  iconRight,
  href,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = `
    inline-flex items-center justify-center gap-sm
    font-label-md font-semibold
    rounded-xl transition-all duration-200
    active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
    focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-primary-container
    custom-shadow-low
  `;

  const variants = {
    primary: `
      bg-primary text-on-primary
      hover:bg-primary-container hover:text-on-primary-container
      shadow-md shadow-primary/20
    `,
    secondary: `
      bg-secondary-container text-on-secondary-container
      hover:bg-secondary hover:text-on-secondary
    `,
    outline: `
      bg-transparent border-2 border-primary text-primary
      hover:bg-primary-fixed-dim hover:text-on-primary-fixed
    `,
    ghost: `
      bg-transparent text-primary
      hover:bg-surface-container hover:text-on-surface
    `,
    destructive: `
      bg-destructive text-destructive-foreground
      hover:bg-destructive/90
    `,
  };

  const sizes = {
    sm: 'px-sm py-sm text-label-sm h-8',
    md: 'px-md py-2.5 text-label-md h-10',
    lg: 'px-lg py-3 text-label-lg h-12',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  const content = (
    <>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </>
  );

  // Render as Link if href is provided
  if (href) {
    return (
      <Link
        href={href}
        className={[
          baseStyles,
          variants[variant],
          sizes[size],
          widthClass,
          className,
        ].filter(Boolean).join(' ')}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      className={[
        baseStyles,
        variants[variant],
        sizes[size],
        widthClass,
        className,
      ].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </button>
  );
}

Button.displayName = 'Button';
