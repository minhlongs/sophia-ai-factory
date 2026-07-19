'use client';

/** RevenueCard — ARR/MRR card with 30d sparkline + tier breakdown table. */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react';
import { formatCurrency } from '@/land/analytics/formatters';
import type { RevenueSnapshot } from '@/seed/types/analytics-revenue';

// ── Props ───────────────────────────────────────────────────────────────────

export interface RevenueCardProps {
  snapshot: RevenueSnapshot | null;
  loading?: boolean;
}

// ── Growth badge ────────────────────────────────────────────────────────────

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">No prior data</span>;
  }
  const positive = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        positive
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      }`}
    >
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {positive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

// ── Stat tile ───────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

function StatTile({ label, value, icon, badge }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl bg-muted/40">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {badge && <div className="mt-1">{badge}</div>}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function RevenueCard({ snapshot, loading }: RevenueCardProps) {
  if (loading || !snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const totalActiveCustomers = snapshot.byTier.reduce((sum, r) => sum + r.customers, 0);

  const chartData = snapshot.trend30d.map(p => ({
    date: p.date.slice(5), // MM-DD
    mrr: p.mrr,
    arr: p.arr,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign size={18} />
          Revenue Overview
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stat tiles */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="ARR"
            value={formatCurrency(snapshot.arr)}
            icon={<DollarSign size={14} />}
          />
          <StatTile
            label="MRR"
            value={formatCurrency(snapshot.mrr)}
            icon={<DollarSign size={14} />}
            badge={<GrowthBadge pct={snapshot.mrrGrowthPct} />}
          />
          <StatTile
            label="MRR Growth"
            value={
              snapshot.mrrGrowthPct !== null
                ? `${snapshot.mrrGrowthPct >= 0 ? '+' : ''}${snapshot.mrrGrowthPct.toFixed(1)}%`
                : 'N/A'
            }
            icon={<TrendingUp size={14} />}
          />
          <StatTile
            label="Active Subscriptions"
            value={totalActiveCustomers.toString()}
            icon={<Users size={14} />}
          />
        </div>

        {/* 30d sparkline */}
        {chartData.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">30-Day MRR Trend</p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: unknown) => [formatCurrency(v as number), 'MRR']}
                  labelFormatter={(l: unknown) => `Date: ${l as string}`}
                />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#mrrGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tier breakdown */}
        {snapshot.byTier.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Tier Breakdown</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Tier</th>
                    <th className="px-3 py-2 text-right font-medium">Customers</th>
                    <th className="px-3 py-2 text-right font-medium">MRR</th>
                    <th className="px-3 py-2 text-right font-medium">ARR</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {snapshot.byTier.map(row => (
                    <tr key={row.tier} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-medium">{row.tier}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.customers}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.mrr)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.arr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
