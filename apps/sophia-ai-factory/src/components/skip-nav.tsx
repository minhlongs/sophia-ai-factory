'use client';

import { useCallback } from 'react';
import { cn } from '@/seed/utils/cn';

export function SkipNav() {
  const handleSkip = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const main = document.querySelector('main');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
    }
  }, []);

  return (
    <a
      href="#main-content"
      onClick={handleSkip}
      className={cn(
        'sr-only fixed top-0 left-0 z-[9999] px-4 py-3',
        'bg-surface text-on-surface font-body-md',
        'border-b border-primary',
        'focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-primary'
      )}
    >
      Skip to main content
      <span className="ml-1 text-on-surface-variant">
        / Chuyển đến nội dung chính
      </span>
    </a>
  );
}
