'use client';

/**
 * Official Google Material Design 3 (MD3 Expressive) React Primitives.
 *
 * Zero hardcoded colors — 100% bound to `--md-sys-*` tonal containers,
 * expressive pill shapes, `tabular-nums`, and semantic ARIA attributes.
 *
 * @module components/md3/md3-primitives
 */

import type { ReactNode } from 'react';
import { cn } from '@/seed/utils/cn';

export function Md3SurfaceCard({
  children,
  className,
  elevated = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly elevated?: boolean;
}) {
  return (
    <div
      className={cn(
        'md3-surface-card p-5 sm:p-6',
        elevated && 'bg-[var(--md-sys-color-surface-container)] shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Md3MetricTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: 'default' | 'primary' | 'success' | 'warning';
}) {
  const valueClass =
    tone === 'primary'
      ? 'text-primary-text'
      : tone === 'success'
        ? 'text-emerald-700 dark:text-emerald-400'
        : tone === 'warning'
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-foreground';

  return (
    <div className="md3-surface-tonal p-4 space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn('md3-tabular-nums text-xl font-bold tracking-tight', valueClass)}>
        {value}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export interface Md3SegmentedOption<T extends string> {
  readonly id: T;
  readonly badge?: string | number;
  readonly label: string;
}

export function Md3SegmentedGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  readonly options: readonly Md3SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly ariaLabel: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2 rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container-lowest)] p-1.5 border border-border"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-current={active ? 'step' : undefined}
            onClick={() => onChange(opt.id)}
            className={cn(
              'md3-pill-button inline-flex flex-1 min-w-[140px] min-h-[44px] items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold',
              active
                ? 'bg-[var(--md-sys-color-primary-container)] text-foreground border border-primary/40 shadow-sm'
                : 'text-muted-foreground hover:text-foreground border border-transparent',
            )}
          >
            {opt.badge !== undefined ? (
              <span
                className={cn(
                  'md3-tabular-nums inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {opt.badge}
              </span>
            ) : null}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
