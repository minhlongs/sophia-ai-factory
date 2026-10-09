import React from 'react';
import type { EmptyStateProps } from './types';

export const LEVEL_COLOR: Record<string, string> = {
  high: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  low: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20',
};

export function getConfidenceLevel(c: number): 'high' | 'medium' | 'low' {
  if (c >= 0.8) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-muted-foreground mb-3">{icon}</div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}
