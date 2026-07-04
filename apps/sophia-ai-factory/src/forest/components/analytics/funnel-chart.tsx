'use client';

/**
 * FunnelChart — Horizontal bar chart visualization for conversion funnels.
 *
 * Renders each funnel group as a card with labeled horizontal bars showing
 * count, drop-off rate, and conversion rate at each step. Uses only
 * Tailwind/HTML — no chart library dependency.
 *
 * Empty state: shows a message prompting the user to start their first campaign.
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { BarChart3 } from 'lucide-react';
import type { FunnelGroup } from '@/land/analytics/funnel-dashboard';

// ── Sub-components ───────────────────────────────────────────────────────────

function FunnelBar({
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

function FunnelDropOff({
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

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyFunnel({
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

// ── Main component ───────────────────────────────────────────────────────────

export interface FunnelChartProps {
  funnels: FunnelGroup[];
}

export function FunnelChart({ funnels }: FunnelChartProps) {
  const t = useTranslations('dashboard.analytics');

  const allEmpty = funnels.every(
    (f) => f.steps.length === 0 || f.steps.every((s) => s.count === 0),
  );

  if (allEmpty) {
    return (
      <div className="space-y-4">
        {funnels.map((funnel) => (
          <EmptyFunnel
            key={funnel.id}
            title={funnel.title}
            description={t('funnel_no_data')}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {funnels.map((funnel) => {
        const maxCount = Math.max(...funnel.steps.map((s) => s.count), 1);

        return (
          <article
            key={funnel.id}
            className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <header className="mb-4">
              <h3 className="text-base font-semibold text-foreground">{funnel.title}</h3>
              <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                {funnel.description}
              </p>
            </header>

            <div className="space-y-4">
              {funnel.steps.map((step, i) => (
                <div key={step.key}>
                  <FunnelBar
                    label={step.name}
                    count={step.count}
                    pct={step.conversionRate}
                    maxCount={maxCount}
                  />
                  {step.dropOffRate !== null && i < funnel.steps.length - 1 && (
                    <div className="mt-0.5 ml-1">
                      <FunnelDropOff dropOffRate={step.dropOffRate} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
