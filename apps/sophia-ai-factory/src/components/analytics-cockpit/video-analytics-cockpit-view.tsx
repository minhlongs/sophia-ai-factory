/**
 * Video Analytics & Net ROI Cockpit Page Component
 * Obsidian Cyber-Glass dashboard integrating KPIs, Retention Curve, MAB, and Attribution.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any.
 * @module components/analytics-cockpit/video-analytics-cockpit-view
 */

'use client';

import React, { useState } from 'react';
import type { ChannelAggregateMetrics, VideoAnalyticsSnapshot } from '@/seed/types/video-analytics-types';
import { AnalyticsKpiSummary } from './analytics-kpi-summary';
import { RetentionCurveChart } from './retention-curve-chart';
import { BanditFlywheelPanel } from './bandit-flywheel-panel';
import { VideoAttributionTable } from './video-attribution-table';
import { Sparkles, RefreshCcw } from 'lucide-react';

interface VideoAnalyticsCockpitViewProps {
  initialMetrics: ChannelAggregateMetrics;
  initialSnapshots: VideoAnalyticsSnapshot[];
  onTriggerSync?: (jobId: string) => Promise<{ success: boolean }>;
}

export function VideoAnalyticsCockpitView({
  initialMetrics,
  initialSnapshots,
  onTriggerSync,
}: VideoAnalyticsCockpitViewProps) {
  const [metrics, setMetrics] = useState<ChannelAggregateMetrics>(initialMetrics);
  const [snapshots, setSnapshots] = useState<VideoAnalyticsSnapshot[]>(initialSnapshots);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSyncVideo = async (jobId: string) => {
    if (onTriggerSync) {
      await onTriggerSync(jobId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Phân Tích Video & Thuộc Tính Net ROI / Analytics Cockpit
            </h1>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Theo dõi chi phí MCU thực tế, tỷ lệ giữ chân 3s, doanh thu chuyển đổi và feedback Bayesian.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/60">
            Obsidian Cyber-Glass v3.2
          </span>
        </div>
      </div>

      {/* 1. Executive KPI Summary Cards */}
      <AnalyticsKpiSummary metrics={metrics} />

      {/* 2. Visual Graphs: Retention Drop-off vs Bayesian Bandit Flywheel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RetentionCurveChart
          threeSecRate={metrics.avgHookScore > 0 ? metrics.avgHookScore / 100 : 0.76}
          q1Rate={0.62}
          completionRate={metrics.avgRetentionScore > 0 ? metrics.avgRetentionScore / 100 * 0.6 : 0.45}
        />
        <BanditFlywheelPanel />
      </div>

      {/* 3. Detailed Publishing Attribution Ledger */}
      <VideoAttributionTable
        snapshots={snapshots}
        onSyncVideo={handleSyncVideo}
      />
    </div>
  );
}
