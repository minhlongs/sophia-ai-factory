import React from 'react';
import { Link } from '@/navigation';
import { Loader2 } from 'lucide-react';
import {
  resolveButtonClasses,
  type ButtonVariant,
  type ButtonSize,
} from './button-styles';

export {
  BUTTON_BASE_STYLES,
  BUTTON_VARIANTS,
  BUTTON_SIZES,
  resolveButtonClasses,
} from './button-styles';
export type { ButtonVariant, ButtonSize } from './button-styles';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: React.ReactNode;
  /** Button variant style */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
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

function renderButtonLink(params: {
  href: string;
  classes: string;
  isDisabled: boolean;
  loading: boolean;
  content: React.ReactNode;
}) {
  const { href, classes, isDisabled, loading, content } = params;
  const isExternal = /^https?:\/\/|^mailto:|^tel:/.test(href);
  const ariaDisabled = isDisabled ? 'true' : undefined;
  const ariaBusy = loading ? 'true' : undefined;
  const tabIndex = isDisabled ? -1 : undefined;

  if (isExternal) {
    return (
      <a
        href={isDisabled ? undefined : href}
        className={classes}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={ariaDisabled}
        aria-busy={ariaBusy}
        tabIndex={tabIndex}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={isDisabled ? '#' : href}
      className={classes}
      aria-disabled={ariaDisabled}
      aria-busy={ariaBusy}
      tabIndex={tabIndex}
    >
      {content}
    </Link>
  );
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
  const content = (
    <>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </>
  );

  const isDisabled = Boolean(disabled || loading);

  if (href) {
    const classes = resolveButtonClasses({
      variant,
      size,
      fullWidth,
      isLinkDisabled: isDisabled,
      className,
    });
    return renderButtonLink({ href, classes, isDisabled, loading, content });
  }

  return (
    <button
      className={resolveButtonClasses({
        variant,
        size,
        fullWidth,
        className,
      })}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      {...props}
    >
      {content}
    </button>
  );
}

Button.displayName = 'Button';
