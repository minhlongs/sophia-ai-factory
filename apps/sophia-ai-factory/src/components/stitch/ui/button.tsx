import React from 'react';
import { Link } from '@/navigation';
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
      bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 text-white
      hover:from-indigo-500 hover:via-indigo-400 hover:to-violet-500
      shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40
      border border-indigo-400/30
    `,
    secondary: `
      bg-white/10 text-white border border-white/10
      hover:bg-white/15 hover:border-white/20
    `,
    outline: `
      bg-transparent border border-white/15 text-slate-200
      hover:bg-white/5 hover:border-indigo-400/50 hover:text-white
    `,
    ghost: `
      bg-transparent text-slate-300
      hover:bg-white/5 hover:text-white
    `,
    destructive: `
      bg-rose-600 text-white
      hover:bg-rose-500 shadow-md shadow-rose-600/25
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

  // Render as Link or <a> if href is provided
  if (href) {
    const isExternal = /^https?:\/\/|^mailto:|^tel:/.test(href);
    const classes = [
      baseStyles,
      variants[variant],
      sizes[size],
      widthClass,
      className,
    ].filter(Boolean).join(' ');

    if (isExternal) {
      return (
        <a
          href={href}
          className={classes}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        href={href}
        className={classes}
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
