'use client';

/**
 * UnifiedRevenueChart — Stacked area chart showing revenue by vertical.
 *
 * Verticals:
 *   SaaS    — green   (#22c55e)
 *   Crypto  — orange  (#f97316)
 *   Product — blue    (#3b82f6)
 *
 * Data source: GET /api/analytics/revenue-unified?period=30d
 * Hover tooltip shows per-vertical breakdown.
 * Time range toggle: 7d | 30d | 90d.
 *
 * Non-tech CEO UX: top-line "Total revenue this month: $X,XXX"
 *
 * @module forest/components/analytics/unified-revenue-chart
 */

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '@/land/analytics/formatters';
import type { UnifiedRevenueSummary } from '@/land/analytics/queries/revenue-unified-query';

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAxisDate(dateStr: string, period: Period): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (period === '7d') return d.toLocaleDateString('en', { weekday: 'short' });
  if (period === '90d') return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

const VERTICAL_COLORS = {
  saas: '#22c55e',
  crypto: '#f97316',
  product: '#3b82f6',
} as const;

const VERTICAL_LABELS = {
  saas: 'SaaS',
  crypto: 'Crypto',
  product: 'Product',
} as const;

// ── Period toggle ─────────────────────────────────────────────────────────────

interface PeriodToggleProps {
  value: Period;
  onChange: (p: Period) => void;
}

function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  const options: Period[] = ['7d', '30d', '90d'];
  return (
    <div className="flex gap-1 rounded-lg border p-1 text-xs">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2 py-1 rounded-md font-medium transition-colors ${
            value === opt
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg text-sm min-w-[140px]">
      <p className="font-medium text-muted-foreground mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{VERTICAL_LABELS[p.name as keyof typeof VERTICAL_LABELS] ?? p.name}</span>
          <span className="font-medium tabular-nums">{formatCurrency(p.value)}</span>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function UnifiedRevenueChart() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<UnifiedRevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/analytics/revenue-unified?period=${period}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as UnifiedRevenueSummary;
        setData(json);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [period]);

  const chartData = data?.dailySeries.map(row => ({
    ...row,
    label: fmtAxisDate(row.date, period),
  })) ?? [];

  const totalLabel = period === '30d' ? 'this month' : `last ${period}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <DollarSign size={18} />
            Unified Revenue
          </CardTitle>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>

        {/* Top-line headline */}
        {data && !loading && (
          <p className="text-sm text-muted-foreground mt-1">
            Total revenue {totalLabel}:{' '}
            <span className="font-bold text-foreground text-base">
              {formatCurrency(data.totalThisMonth)}
            </span>
          </p>
        )}
      </CardHeader>

      <CardContent>
        {loading && <Skeleton className="h-56 w-full rounded-lg" />}
        {error && (
          <p className="text-sm text-red-500 py-4 text-center">
            Failed to load revenue data: {error}
          </p>
        )}
        {!loading && !error && data && (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  {(['saas', 'crypto', 'product'] as const).map(v => (
                    <linearGradient key={v} id={`grad-${v}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={VERTICAL_COLORS[v]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={VERTICAL_COLORS[v]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  hide
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={v => VERTICAL_LABELS[v as keyof typeof VERTICAL_LABELS] ?? v}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px' }}
                />
                {(['saas', 'crypto', 'product'] as const).map(v => (
                  <Area
                    key={v}
                    type="monotone"
                    dataKey={v}
                    name={v}
                    stackId="1"
                    stroke={VERTICAL_COLORS[v]}
                    strokeWidth={2}
                    fill={`url(#grad-${v})`}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>

            {/* Vertical summary pills */}
            <div className="flex gap-3 mt-4 flex-wrap">
              {(['saas', 'crypto', 'product'] as const).map(v => (
                <div
                  key={v}
                  className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: `${VERTICAL_COLORS[v]}20`, color: VERTICAL_COLORS[v] }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: VERTICAL_COLORS[v] }}
                  />
                  {VERTICAL_LABELS[v]}: {formatCurrency(data.byVertical[v])}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
