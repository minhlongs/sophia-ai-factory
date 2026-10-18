import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/seed/utils/cn';

export type StatCardIconColor = 'indigo' | 'emerald' | 'violet' | 'amber' | 'rose' | 'primary';

export interface StatCardTrend {
  value: string;
  isPositive?: boolean;
  isNeutral?: boolean;
}

export const ICON_COLOR_STYLES: Record<StatCardIconColor, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20',
  amber: 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
  primary: 'bg-primary/10 text-primary-700 dark:text-primary-400 border border-primary/20',
};

export function StatCardTrendPill({ trend }: { trend: StatCardTrend }) {
  return (
    <span
      data-testid="stat-card-trend-pill"
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 border',
        trend.isNeutral
          ? 'text-muted-foreground bg-muted/30 border-border'
          : trend.isPositive === false
          ? 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
          : 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      )}
    >
      {trend.isNeutral ? (
        <Minus className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" />
      ) : trend.isPositive === false ? (
        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" />
      ) : (
        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" />
      )}
      <span>{trend.value}</span>
    </span>
  );
}
