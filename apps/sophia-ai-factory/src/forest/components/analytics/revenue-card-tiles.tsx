'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { RevenueSnapshot } from '@/seed/types/analytics-revenue';

export function GrowthBadge({ pct }: { pct: number | null }) {
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
      {positive ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

export interface StatTileProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

export function StatTile({ label, value, icon, badge }: StatTileProps) {
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

export function RevenueTierTable({
  byTier,
  formatCurrency,
}: {
  byTier: RevenueSnapshot['byTier'];
  formatCurrency: (val: number) => string;
}) {
  if (byTier.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground mb-2">Tier Breakdown</p>
      <div className="rounded-lg border overflow-x-auto">
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
            {byTier.map((row) => (
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
  );
}
