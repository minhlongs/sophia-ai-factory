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
import { TrendingUp, DollarSign, Users } from 'lucide-react';
import { formatCurrency } from '@/land/analytics/formatters';
import type { RevenueSnapshot } from '@/seed/types/analytics-revenue';
import { GrowthBadge, StatTile, RevenueTierTable } from './revenue-card-tiles';

// ── Props ───────────────────────────────────────────────────────────────────

export interface RevenueCardProps {
  snapshot: RevenueSnapshot | null;
  loading?: boolean;
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
        <RevenueTierTable byTier={snapshot.byTier} formatCurrency={formatCurrency} />
      </CardContent>
    </Card>
  );
}
