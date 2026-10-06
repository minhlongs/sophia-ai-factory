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

  const getInitials = (str?: string | null) => {
    if (!str) return '?';
    const clean = str.trim();
    if (!clean) return '?';
    if (clean.length <= 2) return clean.toUpperCase();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden shrink-0 select-none',
        'border border-primary/30 p-0.5',
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
            'w-full h-full flex items-center justify-center overflow-hidden',
            'bg-primary/20 text-primary font-bold leading-none',
            shapes[shape]
          )}
        >
          {getInitials(initials || alt)}
        </div>
      )}
    </div>
  );
}

Avatar.displayName = 'Avatar';
