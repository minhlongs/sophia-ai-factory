'use client';

/**
 * @file dashboard-view.tsx
 * @description Composed Growth Analytics Executive Dashboard container.
 * @layer forest
 */

import React, { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import type { GrowthAnalyticsSummary, FunnelStageKey } from '@/seed/types/solutions-types';
import { CustomerHealthMonitor } from '../customer-health-monitor';
import type { GrowthAnalyticsDashboardProps } from './types';
import { MilestoneMetricCards } from './metric-cards';
import { FunnelFlowView } from './funnel-flow-view';
import { ChannelAttributionTable } from './channel-attribution-table';
import { LeadStreamFeed } from './lead-stream-feed';

export function GrowthAnalyticsDashboard({
  initialData,
  locale = 'vi',
}: GrowthAnalyticsDashboardProps) {
  const isVi = locale === 'vi';
  const [data, setData] = useState<GrowthAnalyticsSummary>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeStageFilter, setActiveStageFilter] = useState<FunnelStageKey | 'all'>('all');

  const { mrrProgress, funnelStages, channelAttribution, recentLeads } = data;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setData((prev) => ({
        ...prev,
        toTimestamp: Date.now(),
      }));
      setIsRefreshing(false);
    }, 600);
  };

  const filteredLeads = recentLeads.filter((lead) => {
    if (activeStageFilter === 'all') return true;
    if (activeStageFilter === 'leads') return lead.status === 'new' || lead.status === 'qualified';
    if (activeStageFilter === 'trials') return lead.status === 'demo_sent';
    if (activeStageFilter === 'paid') return lead.status === 'converted';
    return true;
  });

  return (
    <div className="w-full space-y-8 p-6 text-zinc-100">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            {isVi ? 'Hệ Thống Tăng Trưởng Đa Kênh' : 'Omnichannel Growth Engine'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {isVi ? 'Bảng Điều Khiển Tăng Trưởng Doanh Thu' : 'Growth & Revenue Command Center'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {isVi
              ? 'Theo dõi thời gian thực mục tiêu $5.000 MRR, 10 khách hàng trả phí đầu tiên và phễu chuyển đổi 4 giai đoạn.'
              : 'Real-time telemetry for the $5,000 MRR milestone, first 10 paying customers, and 4-stage funnel.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium border border-zinc-700/60 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            {isVi ? 'Làm mới số liệu' : 'Refresh Telemetry'}
          </button>
        </div>
      </div>

      {/* Top Section: $5,000 MRR & 10 Customers Milestone Trackers */}
      <MilestoneMetricCards mrrProgress={mrrProgress} isVi={isVi} />

      {/* Main Section: Visual 4-Stage Conversion Funnel */}
      <FunnelFlowView
        funnelStages={funnelStages}
        activeStageFilter={activeStageFilter}
        setActiveStageFilter={setActiveStageFilter}
        isVi={isVi}
      />

      {/* Two Column Layout: Channel Attribution & Recent Lead Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChannelAttributionTable channelAttribution={channelAttribution} isVi={isVi} />
        <LeadStreamFeed filteredLeads={filteredLeads} isVi={isVi} />
      </div>

      {/* Autonomous Client Retention & Anti-Churn AI Guardian */}
      <div className="pt-4 border-t border-zinc-800/80">
        <CustomerHealthMonitor locale={locale} />
      </div>
    </div>
  );
}
