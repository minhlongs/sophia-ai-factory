'use client';

/**
 * AnalyticsDashboardClient — Client wrapper for the analytics dashboard.
 *
 * Manages global date range state and renders all analytics sections:
 * - DateRangePicker (global state)
 * - UnifiedRevenueChart (ENTERPRISE/MASTER/admin) — SaaS/Crypto/Product stacked area
 * - RevenueCard (ENTERPRISE/MASTER/admin)
 * - TierAdoptionChart (admin only)
 * - Existing AnalyticsView
 *
 * Tier-gating:
 *   BASIC   — AnalyticsView only
 *   PREMIUM — AnalyticsView + RevenueCard (locked banner)
 *   ENTERPRISE/MASTER/admin — all sections including UnifiedRevenueChart
 */

import React, { useState, Suspense, lazy } from 'react';
import { useTranslations } from 'next-intl';
import { DateRangePicker } from '@/forest/components/analytics/date-range-picker';
import { TierAdoptionChart } from '@/forest/components/analytics/tier-adoption-chart';
import { RevenueCard } from '@/forest/components/analytics/revenue-card';
import { UnifiedRevenueChart } from '@/forest/components/analytics/unified-revenue-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Lock, BarChart3 } from 'lucide-react';
import { AnalyticsView } from './analytics-view';
import type { Campaign, Tier } from '@/seed/types';
import type { ISODateRange } from '@/forest/components/analytics/date-range-picker';
import type { RevenueSnapshot } from '@/seed/types/analytics-revenue';

// Lazy-load: no impact on initial analytics paint
const AgentPerformanceCard = lazy(() =>
  import('./agent-performance-card').then((m) => ({ default: m.AgentPerformanceCard }))
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - 30);
  return { from: toISO(from), to: toISO(to) };
}

// ── Locked section ───────────────────────────────────────────────────────────

function LockedSection({ title, message }: { title: string; message: string }) {
  return (
    <Card className="opacity-60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock size={16} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground">
          <BarChart3 size={32} className="opacity-30" />
          <p className="text-sm text-center">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface AnalyticsDashboardClientProps {
  campaigns: Campaign[];
  userTier: Tier;
  userId: string;
  isAdmin: boolean;
  initialRevenue: RevenueSnapshot | null;
}

// ── Main component ───────────────────────────────────────────────────────────

export function AnalyticsDashboardClient({
  campaigns,
  userTier,
  userId,
  isAdmin,
  initialRevenue,
}: AnalyticsDashboardClientProps) {
  const t = useTranslations('dashboard.analytics');
  const [dateRange, setDateRange] = useState(defaultRange());

  const canViewRevenue = isAdmin || userTier === 'ENTERPRISE' || userTier === 'MASTER';
  const canViewTierAdoption = isAdmin;

  const handleDateChange = (range: ISODateRange) => {
    setDateRange({ from: range.from, to: range.to });
  };

  return (
    <div className="space-y-6">
      {/* Global date range picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">{t('date_range') || 'Date range'}:</span>
        <DateRangePicker
          onISOChange={handleDateChange}
          presets={['7d', '30d', '90d', 'month', 'last-month']}
        />
        {dateRange.from && (
          <span className="text-xs text-muted-foreground">
            {dateRange.from} — {dateRange.to}
          </span>
        )}
      </div>

      {/* Unified Revenue chart — ENTERPRISE+ / admin */}
      {canViewRevenue ? (
        <UnifiedRevenueChart />
      ) : null}

      {/* Revenue overview — ENTERPRISE+ / admin */}
      {canViewRevenue ? (
        <RevenueCard snapshot={initialRevenue} loading={false} />
      ) : (
        <LockedSection
          title={t('revenue_locked') || 'Revenue Analytics Locked'}
          message={t('upgrade_for_revenue') || 'Upgrade to Enterprise to view revenue metrics'}
        />
      )}

      {/* Tier adoption chart — admin only */}
      {canViewTierAdoption && (
        <TierAdoptionChart from={dateRange.from} to={dateRange.to} />
      )}

      {/* Existing campaign/usage analytics view */}
      <AnalyticsView
        campaigns={campaigns}
        userTier={userTier}
        userId={userId}
      />

      {/* Phase 03: Agent Performance — lazy-loaded, auto-refreshes every 60s */}
      <Suspense fallback={null}>
        <AgentPerformanceCard />
      </Suspense>
    </div>
  );
}
