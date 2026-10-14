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
import type { LTVByTier, TierLTVRow } from '@/seed/types/analytics-cohort';
import type { Tier } from '@/seed/types';
import {
  TIERS,
  TIER_COLORS,
  LTVTableSection,
  LTVCacInputSection,
  type LTVTableSectionProps,
  type LTVCacInputSectionProps,
} from './ltv-calculator-cards';

export {
  TIERS,
  TIER_COLORS,
  LTVTableSection,
  LTVCacInputSection,
  type LTVTableSectionProps,
  type LTVCacInputSectionProps,
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
        <p className="text-xs text-muted-foreground">
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
          <LTVTableSection rows={rows} ltvCacRatios={data.ltvCacRatios} />
        )}

        {showCacInput && !loading && (
          <LTVCacInputSection
            cac={cac}
            onCacChange={handleCacChange}
            onApplyCac={handleApplyCac}
          />
        )}
      </CardContent>
    </Card>
  );
}
