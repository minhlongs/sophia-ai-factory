// i18n-namespace: stitch.affiliates
'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Users } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import type { AffiliateStats } from './types';

export function useLiveAffiliateStats(
  stats?: AffiliateStats,
  initialStats?: AffiliateStats,
): AffiliateStats | null {
  const [liveStats, setLiveStats] = useState<AffiliateStats | null>(null);

  useEffect(() => {
    if (stats || initialStats) return;

    let isMounted = true;
    fetch('/api/affiliates/stats')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json() as Promise<{
          success?: boolean;
          stats?: {
            totalAffiliates?: number;
            activeAffiliates?: number;
            totalCommissionCents?: number;
            pendingCommissionCents?: number;
          };
        }>;
      })
      .then((data) => {
        if (isMounted && data?.success && data?.stats) {
          const s = data.stats;
          const totalComm =
            s.totalCommissionCents != null
              ? `$${(s.totalCommissionCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '$0.00';
          const pendComm =
            s.pendingCommissionCents != null
              ? `$${(s.pendingCommissionCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '$0.00';

          setLiveStats({
            total: s.totalAffiliates,
            active: s.activeAffiliates,
            totalCommission: totalComm,
            pendingCommission: pendComm,
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [stats, initialStats]);

  return liveStats;
}

export function AffiliatesTabSwitcher({
  activeTab,
  onSelectTab,
  t,
}: {
  activeTab: 'partners' | 'discovery';
  onSelectTab: (tab: 'partners' | 'discovery') => void;
  t: (key: string) => string;
}) {
  return (
    <div
      className="flex items-center gap-2 mb-6 border-b border-white/[0.08] pb-3"
      role="tablist"
      aria-label={t('partnersTab')}
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'partners'}
        aria-controls="affiliates-partners-tab"
        id="affiliates-partners-tab-btn"
        onClick={() => onSelectTab('partners')}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          activeTab === 'partners'
            ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-sm shadow-primary/10'
            : 'text-muted-foreground hover:text-white hover:bg-white/[0.04]',
        )}
      >
        <Users className="w-4 h-4" />
        <span>{t('partnersTab')}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'discovery'}
        aria-controls="affiliates-discovery-tab"
        id="affiliates-discovery-tab-btn"
        onClick={() => onSelectTab('discovery')}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          activeTab === 'discovery'
            ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-sm shadow-primary/10'
            : 'text-muted-foreground hover:text-white hover:bg-white/[0.04]',
        )}
      >
        <Sparkles className="w-4 h-4" />
        <span>{t('discoveryTab')}</span>
      </button>
    </div>
  );
}
