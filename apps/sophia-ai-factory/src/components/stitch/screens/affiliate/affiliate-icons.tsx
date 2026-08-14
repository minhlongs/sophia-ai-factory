import React from 'react';
import { cn } from '@/seed/utils/cn';

/**
 * Reusable SVG social platform icon.
 */
export function SocialIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg className={cn('w-5 h-5 fill-current', className)} viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}
