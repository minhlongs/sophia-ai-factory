'use client';
/**
 * Sidebar Quota Widget — compact at-a-glance monthly credits indicator.
 *
 * Wave 20 Phase 03 (7C): renders inside dashboard left sidebar so users see
 * "credits used / limit" without navigating to /dashboard/billing.
 *
 * - Fetches `/api/quota/status` via TanStack Query (shared cache).
 * - Hides silently when loading/error/no-license (BASIC pre-checkout user).
 * - MASTER tier renders `<used> / ∞` with no progress bar (lifetime/unlimited).
 * - Click anywhere on widget -> navigates to `/dashboard/billing`.
 *
 * @module forest/components/dashboard/sidebar-quota-widget
 */

import { Link } from '@/navigation';
import { useQuery } from '@tanstack/react-query';
import { Infinity as InfinityIcon, BarChart3, Film } from 'lucide-react';
import { fetchJson } from '@/seed/utils/fetch-json';
import { useTranslations } from 'next-intl';

interface QuotaStatusResponse {
  license: { nonce: string; tier: string };
  quota: {
    usage: { hourly: number; daily: number; monthly: number };
    limits: { hourlyCredits: number; dailyCredits: number; monthlyCredits: number };
    percentages: { hourly: number; daily: number; monthly: number };
    status: 'ok' | 'warning' | 'critical';
  };
  video?: {
    used: number;
    limit: number;
  };
}

const UNLIMITED_THRESHOLD = 999_990;

export function SidebarQuotaWidget() {
  const t = useTranslations('dashboard.sidebar.quotaWidget');
  const { data, isLoading, isError } = useQuery<QuotaStatusResponse>({
    queryKey: ['/api/quota/status'],
    queryFn: () => fetchJson<QuotaStatusResponse>('/api/quota/status'),
    retry: 0,
    staleTime: 60_000,
  });

  if (isLoading || isError || !data) return null;

  const tier = data.license.tier?.toUpperCase() ?? 'BASIC';
  const used = Math.max(0, Math.round(data.quota.usage.monthly));
  const limit = data.quota.limits.monthlyCredits;
  const isUnlimited = tier === 'MASTER' || limit >= UNLIMITED_THRESHOLD;

  return (
    <Link
      href="/dashboard/billing"
      className="block rounded-lg border border-border bg-muted/30 px-3 py-2.5 hover:bg-muted/50 transition-colors min-h-[44px]"
      aria-label={t('viewBilling')}
      data-testid="sidebar-quota-widget"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('title')}
        </span>
      </div>
      {isUnlimited ? (
        <div className="flex items-baseline gap-1.5 text-foreground">
          <span className="text-sm font-semibold tabular-nums">{used}</span>
          <span className="text-xs text-muted-foreground">/</span>
          <InfinityIcon className="h-4 w-4 text-amber-400" aria-label={t('unlimited')} />
        </div>
      ) : (
        <QuotaBar used={used} limit={limit} />
      )}
      {data.video && (
        <div className="mt-2 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2 mb-1.5">
            <Film className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('videos')}
            </span>
          </div>
          {data.video.limit >= 999 ? (
            <div className="flex items-baseline gap-1.5 text-foreground">
              <span className="text-sm font-semibold tabular-nums">{data.video.used}</span>
              <span className="text-xs text-muted-foreground">/</span>
              <InfinityIcon className="h-4 w-4 text-amber-400" aria-label={t('unlimited')} />
            </div>
          ) : (
            <QuotaBar used={data.video.used} limit={data.video.limit} />
          )}
        </div>
      )}
    </Link>
  );
}

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const safeLimit = Math.max(1, limit);
  const pct = Math.min(100, Math.round((used / safeLimit) * 100));
  const isWarning = pct >= 75;
  const isCritical = pct >= 90;
  const barColor = isCritical ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-primary';

  return (
    <>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {used}
          <span className="text-muted-foreground font-normal"> / {limit}</span>
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-label="Quota usage progress"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  );
}
