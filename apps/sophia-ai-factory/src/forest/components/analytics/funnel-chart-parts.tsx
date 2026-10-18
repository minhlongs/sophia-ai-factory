'use client';

/**
 * FunnelChart Sub-components — Bar, DropOff, and EmptyFunnel.
 *
 * @module forest/components/analytics/funnel-chart-parts
 */

import React from 'react';
import { BarChart3 } from 'lucide-react';

export function FunnelBar({
  label,
  count,
  pct,
  maxCount,
}: {
  label: string;
  count: number;
  pct: number;
  maxCount: number;
}) {
  const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground truncate">{label}</span>
        <span className="font-mono font-semibold tabular-nums">{count.toLocaleString()}</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-muted/40 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${barWidth}%`,
            background: 'linear-gradient(90deg, hsl(35 78% 62%), hsl(35 80% 44%))',
          }}
          role="progressbar"
          aria-valuenow={count}
          aria-valuemin={0}
          aria-valuemax={maxCount}
          aria-label={`${label}: ${count} (${pct.toFixed(1)}%)`}
        />
      </div>
      {pct < 100 && (
        <p className="text-[11px] text-muted-foreground/70">
          {pct.toFixed(1)}% retention
        </p>
      )}
    </div>
  );
}

export function FunnelDropOff({
  dropOffRate,
}: {
  dropOffRate: number | null;
}) {
  if (dropOffRate === null) return null;

  const color = dropOffRate > 50
    ? 'text-red-500/80'
    : dropOffRate > 20
      ? 'text-amber-500/80'
      : 'text-green-500/80';

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
      <span className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent border-b-current rotate-180" />
      {dropOffRate.toFixed(1)}% drop
    </div>
  );
}

export function EmptyFunnel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-dashed border-border/50 bg-muted/5 p-8 text-center">
      <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" aria-hidden="true" />
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
        {description}
      </p>
    </article>
  );
}
