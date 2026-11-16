'use client';

/**
 * ZEN DESIGN OS v1.0 — Dual-Theme Toggle (Dark Default / Light Executive Ivory)
 * Layer: forest (Application shell control)
 *
 * Accessible keyboard & screen-reader theme switch between:
 * - `dark`: Director's Control Deck (default)
 * - `light`: Executive Studio Ivory
 */

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentMode = mounted ? (resolvedTheme ?? theme ?? 'dark') : 'dark';
  const isDark = currentMode !== 'light';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const label = isDark
    ? 'Chuyển sang giao diện Sáng (Executive Studio Ivory) / Switch to Light Mode'
    : 'Chuyển sang giao diện Tối (Director Control Deck) / Switch to Dark Mode';

  return (
    <button
      type="button"
      onClick={handleToggle}
      data-testid="theme-toggle"
      aria-label={label}
      aria-pressed={!isDark}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/80 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`.trim()}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-150" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 text-indigo-600 transition-transform duration-150" aria-hidden="true" />
      )}
    </button>
  );
}
