'use client';

import React from 'react';
import { Eye, Heart, GitCompare } from 'lucide-react';
import { useTranslations } from 'next-intl';

/* ───────────────────────────────────────────────────────────────
 * DashboardStats — bento grid of KPI cards + GPU/projects row
 * ─────────────────────────────────────────────────────────────── */

export function DashboardStats({
  activeCampaigns,
  totalImpressions,
  engagementRate,
  avgConversion,
  activeRenders,
  gpuUsed,
  gpuTotal,
}: {
  activeCampaigns?: number;
  totalImpressions?: string;
  engagementRate?: string;
  avgConversion?: string;
  activeRenders?: number;
  gpuUsed?: number;
  gpuTotal?: number;
}) {
  const t = useTranslations('stitch.dashboardShell');
  const gpuPercent = gpuTotal && gpuUsed ? Math.round((gpuUsed / gpuTotal) * 100) : 70;

  return (
    <>
      {/* Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Campaigns */}
        <div className="glass-card p-5 rounded-xl space-y-3 bg-primary-container/20 border-primary/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              {t('stats.activeCampaigns')}
            </span>
            <Eye className="w-4 h-4 text-primary-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-on-surface">
              {activeCampaigns ?? 12}
            </span>
            <span className="text-[10px] text-primary">+3</span>
          </div>
          <p className="text-[10px] text-on-surface-variant">
            {t('stats.running')}
          </p>
        </div>

        {/* Total Impressions */}
        <div className="glass-card p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              {t('stats.impressions')}
            </span>
            <Heart className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-on-surface">
              {totalImpressions || '1.2M'}
            </span>
            <span className="text-[10px] text-emerald-400">+18.2%</span>
          </div>
          <p className="text-[10px] text-on-surface-variant">
            {t('stats.thisMonth')}
          </p>
        </div>

        {/* Engagement Rate */}
        <div className="glass-card p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              {t('stats.engagement')}
            </span>
            <GitCompare className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-on-surface">
              {engagementRate || '4.8%'}
            </span>
            <span className="text-[10px] text-error">-0.8%</span>
          </div>
          <p className="text-[10px] text-on-surface-variant">
            {t('stats.industryAvg')}
          </p>
        </div>

        {/* Active Renders */}
        <div className="glass-card p-5 rounded-xl space-y-3 bg-primary-container/20 border-primary/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              {t('stats.activeRenders')}
            </span>
            <div className="relative">
              <svg className="w-4 h-4 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-on-surface">{activeRenders ?? 14}</span>
          </div>
          <div className="flex -space-x-2">
            <div className="w-6 h-6 rounded-full bg-surface-container-highest border border-outline-variant" />
            <div className="w-6 h-6 rounded-full bg-surface-container-high border border-outline-variant" />
            <div className="w-6 h-6 rounded-full bg-primary border border-outline-variant flex items-center justify-center text-[8px] font-bold text-on-primary">
              +12
            </div>
          </div>
        </div>
      </div>

      {/* GPU Usage + Avg Conversion */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-xl space-y-3">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            {t('stats.gpuUsage')}
          </span>
          <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${gpuPercent}%` }} />
          </div>
          <p className="text-[10px] text-on-surface-variant">
            {gpuUsed ?? 7} / {gpuTotal ?? 10} {t('stats.cores')}
          </p>
        </div>

        <div className="glass-card p-5 rounded-xl space-y-3">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            {t('stats.avgConversion')}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-on-surface">{avgConversion || '4.8%'}</span>
            <span className="text-[10px] text-primary">+2.1%</span>
          </div>
          <p className="text-[10px] text-on-surface-variant">{t('stats.industryAvg')}</p>
        </div>
      </div>
    </>
  );
}
