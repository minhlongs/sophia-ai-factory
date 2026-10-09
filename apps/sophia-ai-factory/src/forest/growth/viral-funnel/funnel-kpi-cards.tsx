/**
 * Viral Funnel Aggregate KPI Metric Cards
 *
 * Layer: Forest (UI components & coordinators)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/viral-funnel/funnel-kpi-cards
 */

import React from 'react';
import { Eye, MousePointerClick, Users, DollarSign, ArrowUpRight } from 'lucide-react';
import type { ViralFunnelOverview } from '@/seed/types/growth';

interface FunnelKpiCardsProps {
  overview: ViralFunnelOverview;
  isVi: boolean;
}

export function FunnelKpiCards({ overview, isVi }: FunnelKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Views */}
      <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-400">
            {isVi ? 'Tổng Lượt Xem' : 'Total Views'}
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Eye className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">
            {overview.totalViews.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-emerald-400 flex items-center">
            <ArrowUpRight className="w-3 h-3" /> +18.4%
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {isVi
            ? `Trên ${overview.totalVideos} video đã đăng`
            : `Across ${overview.totalVideos} published videos`}
        </p>
      </div>

      {/* Total CTA Clicks & Avg CTR */}
      <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-400">
            {isVi ? 'Lượt Bấm Nút CTA (CTR)' : 'CTA Clicks (CTR %)'}
          </span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <MousePointerClick className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">
            {overview.totalCtaClicks.toLocaleString()}
          </span>
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
            {overview.averageCtrPct}% CTR
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {isVi ? 'Lượng truy cập phễu đăng ký' : 'Funnel traffic into landing/bot'}
        </p>
      </div>

      {/* Total Leads Generated */}
      <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-400">
            {isVi ? 'Leads Đã Thu Thập' : 'Leads Captured'}
          </span>
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">
            {overview.totalLeads.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-purple-400 flex items-center">
            <ArrowUpRight className="w-3 h-3" /> 8.6% cvr
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {isVi ? 'Qua bot Telegram & web' : 'Via Telegram bot & web'}
        </p>
      </div>

      {/* Revenue Attributed */}
      <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-400">
            {isVi ? 'Doanh Thu Chuyển Đổi' : 'Revenue Generated'}
          </span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">
            ${overview.totalRevenueUsd.toLocaleString()}
          </span>
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
            {overview.totalConversions} {isVi ? 'khách' : 'paid'}
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {isVi ? 'Mục tiêu: $5,000 MRR' : 'Target: $5,000 MRR'}
        </p>
      </div>
    </div>
  );
}
