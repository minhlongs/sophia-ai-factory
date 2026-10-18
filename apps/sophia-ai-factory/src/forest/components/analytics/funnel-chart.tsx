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
import type { FunnelGroup } from '@/seed/types/analytics-funnel';
import { FunnelBar, FunnelDropOff, EmptyFunnel } from './funnel-chart-parts';

export { FunnelBar, FunnelDropOff, EmptyFunnel };

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
