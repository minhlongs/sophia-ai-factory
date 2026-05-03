'use client';

/**
 * LTVCalculator — Table showing ARPU, avg lifetime, and LTV per tier.
 * Optional manual CAC input → computes LTV:CAC ratio.
 *
 * Data source: GET /api/analytics/cohorts?metric=ltv
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { Input } from '@/seed/components/ui/input';
import type { LTVByTier, TierLTVRow } from '@/seed/types/analytics-cohort';
import type { Tier } from '@/seed/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

const TIER_COLORS: Record<Tier, string> = {
  BASIC: 'bg-slate-100 text-slate-700',
  PREMIUM: 'bg-blue-100 text-blue-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
  MASTER: 'bg-amber-100 text-amber-700',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface LTVCalculatorProps {
  /** Show CAC input section (default true) */
  showCacInput?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LTVCalculator({ showCacInput = true }: LTVCalculatorProps) {
  const [data, setData] = useState<LTVByTier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cac, setCac] = useState<Partial<Record<Tier, string>>>({});

  const load = useCallback(async (cacValues?: Partial<Record<Tier, string>>) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ metric: 'ltv' });
      if (cacValues) {
        for (const tier of TIERS) {
          const val = cacValues[tier];
          if (val && !isNaN(parseFloat(val))) {
            params.set(`cac_${tier}`, val);
          }
        }
      }
      const res = await fetch(`/api/analytics/cohorts?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as LTVByTier;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleCacChange(tier: Tier, value: string) {
    setCac(prev => ({ ...prev, [tier]: value }));
  }

  function handleApplyCac() {
    load(cac);
  }

  // Build display rows — fill in missing tiers with zeros
  const rows: TierLTVRow[] = TIERS.map(tier => {
    return data?.tiers.find(r => r.tier === tier) ?? {
      tier,
      arpu: 0,
      avgLifetimeMonths: 0,
      ltv: 0,
      customers: 0,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">LTV by Tier</CardTitle>
        <p className="text-xs text-gray-500">
          LTV = ARPU × Avg Lifetime Months
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-2">
            {TIERS.map(t => <Skeleton key={t} className="h-10 w-full" />)}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500">Failed to load LTV data: {error}</p>
        )}

        {!loading && data && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-600">Tier</th>
                  <th className="text-right py-2 font-medium text-gray-600">Customers</th>
                  <th className="text-right py-2 font-medium text-gray-600">ARPU/mo</th>
                  <th className="text-right py-2 font-medium text-gray-600">Avg Lifetime</th>
                  <th className="text-right py-2 font-medium text-gray-600">LTV</th>
                  {data.ltvCacRatios && (
                    <th className="text-right py-2 font-medium text-gray-600">LTV:CAC</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.tier} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIER_COLORS[row.tier]}`}>
                        {row.tier}
                      </span>
                    </td>
                    <td className="text-right py-2 text-gray-700">{row.customers}</td>
                    <td className="text-right py-2 text-gray-700">${row.arpu.toFixed(2)}</td>
                    <td className="text-right py-2 text-gray-700">{row.avgLifetimeMonths}mo</td>
                    <td className="text-right py-2 font-semibold text-gray-900">
                      ${row.ltv.toFixed(2)}
                    </td>
                    {data.ltvCacRatios && (
                      <td className="text-right py-2 text-gray-700">
                        {data.ltvCacRatios[row.tier] != null
                          ? `${data.ltvCacRatios[row.tier]}×`
                          : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showCacInput && !loading && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-medium text-gray-600">
              Optional: enter CAC per tier to compute LTV:CAC ratio
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIERS.map(tier => (
                <div key={tier} className="space-y-1">
                  <label className="text-xs text-gray-500">{tier} CAC ($)</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 50"
                    value={cac[tier] ?? ''}
                    onChange={e => handleCacChange(tier, e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleApplyCac}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Apply CAC
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
