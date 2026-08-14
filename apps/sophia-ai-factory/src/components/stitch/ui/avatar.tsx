import React from 'react';
import { cn } from '@/seed/utils/cn';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Avatar image source */
  src?: string | null;
  /** Avatar alt text */
  alt?: string;
  /** Fallback initials when no image */
  initials?: string;
  /** Avatar size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Avatar shape */
  shape?: 'circle' | 'square';
}

/**
 * Stitch-compatible Avatar component
 *
 * Material Design 3 avatar styles with Sophia theme.
 */
export function Avatar({
  src,
  alt = '',
  initials,
  size = 'md',
  shape = 'circle',
  className = '',
  ...props
}: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const shapes = {
    circle: 'rounded-full',
    square: 'rounded-xl',
  };

  const initialsBgColors = [
    'bg-primary-fixed',
    'bg-secondary-fixed',
    'bg-tertiary-fixed',
    'bg-surface-container-high',
  ];

  const getInitialsColor = (index: number) => initialsBgColors[index % initialsBgColors.length];

  const getInitials = (str: string) => {
    if (!str) return '?';
    return str
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        'border-2 border-primary-container p-0.5',
        'group-hover:scale-105 transition-transform',
        shapes[shape],
        sizes[size],
        className
      )}
      {...props}
    >
      {src ? (
        <img // eslint-disable-line @next/next/no-img-element -- dynamic src URL
          src={src}
          alt={alt}
          className={cn(
            'w-full h-full object-cover',
            shapes[shape]
          )}
        />
      ) : (
        <div
          className={cn(
            'w-full h-full flex items-center justify-center',
            getInitialsColor(0),
            shapes[shape],
            'text-on-secondary-fixed font-semibold'
          )}
        >
          { initials || getInitials(alt)}
        </div>
      )}
    </div>
  );
}

Avatar.displayName = 'Avatar';
