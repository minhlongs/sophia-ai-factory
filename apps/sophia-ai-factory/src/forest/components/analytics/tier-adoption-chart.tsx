'use client';

/**
 * TierAdoptionChart — Stacked area chart showing daily active subscriptions per tier.
 *
 * Data source: GET /api/analytics/tier-adoption
 * Colors: BASIC=gray, PREMIUM=blue, ENTERPRISE=purple, MASTER=gold
 */

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import type { TierAdoptionChartRow } from '@/seed/types/analytics-tier';
import {
  TIER_COLORS,
  TIERS,
  TierAdoptionTooltip,
} from './tier-adoption-tooltip';

// ── Props ────────────────────────────────────────────────────────────────────

export interface TierAdoptionChartProps {
  from: string;
  to: string;
}

// ── Main component ───────────────────────────────────────────────────────────

export function TierAdoptionChart({ from, to }: TierAdoptionChartProps) {
  const t = useTranslations('dashboard.analytics');
  const [data, setData] = useState<TierAdoptionChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/analytics/tier-adoption?from=${from}&to=${to}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ chartRows: TierAdoptionChartRow[] }>;
      })
      .then(body => {
        if (!cancelled) {
          setData(body.chartRows ?? []);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tier adoption data');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [from, to]);

  if (loading || error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('tier_adoption_title') || 'Tier Adoption Timeline'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[280px] w-full rounded-lg" />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const formatDate = (d: string) => d.slice(5).replace('-', '/');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tier_adoption_title') || 'Tier Adoption Timeline'}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            {t('no_data') || 'No data available'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <defs>
                {TIERS.map(tier => (
                  <linearGradient key={tier} id={`grad-${tier}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TIER_COLORS[tier]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={TIER_COLORS[tier]} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<TierAdoptionTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {TIERS.map(tier => (
                <Area
                  key={tier} type="monotone" dataKey={tier} stackId="1"
                  stroke={TIER_COLORS[tier]} strokeWidth={2} fill={`url(#grad-${tier})`} dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
