/**
 * Video Analytics KPI Summary Component
 * Displays executive net margin, ROI %, and composite Hook & Retention aggregates.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any.
 * @module components/analytics-cockpit/analytics-kpi-summary
 */

'use client';

import React from 'react';
import type { ChannelAggregateMetrics } from '@/seed/types/video-analytics-types';
import { TrendingUp, DollarSign, Eye, Flame, Compass, Video } from 'lucide-react';

interface AnalyticsKpiSummaryProps {
  metrics: ChannelAggregateMetrics;
}

export function AnalyticsKpiSummary({ metrics }: AnalyticsKpiSummaryProps) {
  const isProfitable = metrics.totalNetMarginUsd >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Total Attributed Revenue */}
      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4 transition-all hover:border-emerald-500/30">
        <div className="flex items-center justify-between text-xs text-white/50 mb-2">
          <span>Doanh Thu / Revenue</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-xl font-bold tracking-tight text-white">
          ${metrics.totalRevenueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
          <span>+ Sub-ID tracked</span>
        </div>
      </div>

      {/* 2. Total Net Margin */}
      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4 transition-all hover:border-amber-500/30">
        <div className="flex items-center justify-between text-xs text-white/50 mb-2">
          <span>Lợi Nhuận Thuần / Net</span>
          <TrendingUp className={`w-4 h-4 ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`} />
        </div>
        <div className={`text-xl font-bold tracking-tight ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
          ${metrics.totalNetMarginUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-white/40 mt-1">
          Chi phí: ${metrics.totalCostUsd.toFixed(2)}
        </div>
      </div>

      {/* 3. Overall Net ROI */}
      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4 transition-all hover:border-purple-500/30">
        <div className="flex items-center justify-between text-xs text-white/50 mb-2">
          <span>Tỷ Suất ROI / Net ROI</span>
          <span className="text-xs font-mono text-purple-400 font-semibold">%</span>
        </div>
        <div className="text-xl font-bold tracking-tight text-purple-400">
          {metrics.roiPercent >= 0 ? `+${metrics.roiPercent.toFixed(1)}%` : `${metrics.roiPercent.toFixed(1)}%`}
        </div>
        <div className="text-[11px] text-white/40 mt-1">
          Trên tổng MCU & BYOK
        </div>
      </div>

      {/* 4. Total Views */}
      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4 transition-all hover:border-sky-500/30">
        <div className="flex items-center justify-between text-xs text-white/50 mb-2">
          <span>Lượt Xem / Views</span>
          <Eye className="w-4 h-4 text-sky-400" />
        </div>
        <div className="text-xl font-bold tracking-tight text-white">
          {metrics.totalViews.toLocaleString()}
        </div>
        <div className="text-[11px] text-white/40 mt-1">
          {metrics.publishedCount} video xuất bản
        </div>
      </div>

      {/* 5. Hook Score */}
      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4 transition-all hover:border-amber-500/30">
        <div className="flex items-center justify-between text-xs text-white/50 mb-2">
          <span>Điểm Hook / Hook (3s)</span>
          <Flame className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-xl font-bold tracking-tight text-amber-400">
          {metrics.avgHookScore}
          <span className="text-xs text-white/40 font-normal"> / 100</span>
        </div>
        <div className="text-[11px] text-amber-400/80 mt-1">
          {metrics.avgHookScore >= 75 ? '🔥 High Viral Potential' : 'Standard Baseline'}
        </div>
      </div>

      {/* 6. Retention Score */}
      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4 transition-all hover:border-indigo-500/30">
        <div className="flex items-center justify-between text-xs text-white/50 mb-2">
          <span>Điểm Giữ Chân / Retention</span>
          <Compass className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-xl font-bold tracking-tight text-indigo-400">
          {metrics.avgRetentionScore}
          <span className="text-xs text-white/40 font-normal"> / 100</span>
        </div>
        <div className="text-[11px] text-indigo-400/80 mt-1">
          {metrics.avgRetentionScore >= 70 ? '🎯 Strong Loop Rate' : 'Healthy Pacing'}
        </div>
      </div>
    </div>
  );
}
