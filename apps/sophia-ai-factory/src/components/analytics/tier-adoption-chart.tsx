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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import type { TierAdoptionChartRow } from '@/types/analytics-tier';

// ── Constants ────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  BASIC: '#94a3b8',      // slate-400
  PREMIUM: '#3b82f6',    // blue-500
  ENTERPRISE: '#a855f7', // purple-500
  MASTER: '#f59e0b',     // amber-500
};

const TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

// ── Props ────────────────────────────────────────────────────────────────────

export interface TierAdoptionChartProps {
  from: string;
  to: string;
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="font-medium mb-2">{label}</p>
      {payload.map(entry => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('tier_adoption_title') || 'Tier Adoption Timeline'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('tier_adoption_title') || 'Tier Adoption Timeline'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format x-axis label: YYYY-MM-DD → MM/DD
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
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {TIERS.map(tier => (
                <Area
                  key={tier}
                  type="monotone"
                  dataKey={tier}
                  stackId="1"
                  stroke={TIER_COLORS[tier]}
                  strokeWidth={2}
                  fill={`url(#grad-${tier})`}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
