'use client';

/**
 * LTVCalculator Subcomponents — Table & CAC Input Section
 *
 * Extracted from ltv-calculator.tsx to keep both files under 140 LOC.
 */

import React from 'react';
import { Input } from '@/seed/components/ui/input';
import type { LTVByTier, TierLTVRow } from '@/seed/types/analytics-cohort';
import type { Tier } from '@/seed/types';

export const TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

export const TIER_COLORS: Record<Tier, string> = {
  BASIC: 'bg-muted text-foreground',
  PREMIUM: 'bg-blue-100 text-blue-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
  MASTER: 'bg-amber-100 text-amber-700',
};

export interface LTVTableSectionProps {
  rows: TierLTVRow[];
  ltvCacRatios?: LTVByTier['ltvCacRatios'];
}

export function LTVTableSection({ rows, ltvCacRatios }: LTVTableSectionProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 font-medium text-foreground">Tier</th>
            <th className="text-right py-2 font-medium text-foreground">Customers</th>
            <th className="text-right py-2 font-medium text-foreground">ARPU/mo</th>
            <th className="text-right py-2 font-medium text-foreground">Avg Lifetime</th>
            <th className="text-right py-2 font-medium text-foreground">LTV</th>
            {ltvCacRatios && (
              <th className="text-right py-2 font-medium text-foreground">LTV:CAC</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.tier} className="bg-background hover:bg-muted">
              <td className="py-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIER_COLORS[row.tier]}`}>
                  {row.tier}
                </span>
              </td>
              <td className="text-right py-2 text-foreground">{row.customers}</td>
              <td className="text-right py-2 text-foreground">${row.arpu.toFixed(2)}</td>
              <td className="text-right py-2 text-foreground">{row.avgLifetimeMonths}mo</td>
              <td className="text-right py-2 font-semibold text-foreground">
                ${row.ltv.toFixed(2)}
              </td>
              {ltvCacRatios && (
                <td className="text-right py-2 text-foreground">
                  {ltvCacRatios[row.tier] != null
                    ? `${ltvCacRatios[row.tier]}×`
                    : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface LTVCacInputSectionProps {
  cac: Partial<Record<Tier, string>>;
  onCacChange: (tier: Tier, value: string) => void;
  onApplyCac: () => void;
}

export function LTVCacInputSection({
  cac,
  onCacChange,
  onApplyCac,
}: LTVCacInputSectionProps) {
  return (
    <div className="border-t border-border pt-4 space-y-3">
      <p className="text-xs font-medium text-foreground">
        Optional: enter CAC per tier to compute LTV:CAC ratio
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TIERS.map(tier => (
          <div key={tier} className="space-y-1">
            <label className="text-xs text-muted-foreground">{tier} CAC ($)</label>
            <Input
              type="number"
              min={0}
              placeholder="e.g. 50"
              value={cac[tier] ?? ''}
              onChange={e => onCacChange(tier, e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>
      <button
        onClick={onApplyCac}
        className="text-xs px-3 py-1.5 bg-background text-foreground rounded hover:bg-muted transition-colors"
      >
        Apply CAC
      </button>
    </div>
  );
}
