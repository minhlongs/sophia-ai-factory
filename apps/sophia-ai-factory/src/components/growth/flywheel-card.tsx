'use client';

/**
 * Presentation Layer: Autonomous Monetization Flywheel HUD Card
 * Displays real-time retention Z-score triggers, hook divergence, and affiliate attribution ledger.
 * Layer: presentation/components/growth | Max LOC: < 200 | Zero :any
 * @module components/growth/flywheel-card
 */

import React, { useState } from 'react';
import type { FlywheelSummaryStats } from '@/seed/types/growth-triad-v12';

export interface FlywheelCardProps {
  stats: FlywheelSummaryStats;
  locale?: string;
  onRefresh?: () => Promise<void> | void;
}

export function FlywheelCard({ stats, locale = 'vi', onRefresh }: FlywheelCardProps) {
  const isVi = locale === 'vi';
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/20 bg-neutral-950/70 p-6 text-neutral-100 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-800 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              {isVi ? 'Bánh đà Tự động Hóa Doanh thu (Flywheel v12)' : 'Autonomous Monetization Flywheel (v12)'}
            </h2>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            {isVi
              ? 'Tự động nhân giống video Alpha Viral (Z ≥ 1.5) & Đối soát hoa hồng affiliate đa kênh.'
              : 'Autonomous Alpha Viral video reseeding (Z ≥ 1.5) & cross-network affiliate attribution.'}
          </p>
        </div>

        <button
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition-all hover:bg-amber-500/20 disabled:opacity-50"
        >
          {isRefreshing ? (isVi ? 'Đang đồng bộ...' : 'Syncing...') : isVi ? 'Đồng bộ Dữ liệu' : 'Sync Metrics'}
        </button>
      </div>

      {/* KPI Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* KPI 1: Alpha Viral Detected */}
        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {isVi ? 'Video Alpha Viral (Z ≥ 1.5)' : 'Alpha Viral Detected'}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400">{stats.alphaViralDetected}</span>
            <span className="text-xs text-neutral-500">/ {stats.totalReseedJobs} jobs</span>
          </div>
        </div>

        {/* KPI 2: Reseed Executed */}
        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {isVi ? 'Chiến dịch Đã Nhân giống' : 'Autonomous Reseeds'}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">{stats.reseededCount}</span>
            <span className="text-xs text-neutral-500">{isVi ? 'tự động' : 'active'}</span>
          </div>
        </div>

        {/* KPI 3: Attributed Revenue */}
        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {isVi ? 'Doanh thu Đối soát' : 'Attributed Revenue'}
          </p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">
              ${stats.totalAttributedRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* KPI 4: Total Commission */}
        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {isVi ? 'Hoa hồng Ròng (Commission)' : 'Net Commission'}
          </p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-300">
              ${stats.totalCommissionUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Flywheel Operational State Footnote */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800/60 pt-4 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>
            {isVi
              ? 'Trạng thái Bánh đà: Sẵn sàng tự động kích hoạt biến dị Darwin khi video bứt phá ngưỡng'
              : 'Flywheel Engine: Standing by to mutate hooks upon retention threshold breach'}
          </span>
        </div>
        <span className="font-mono text-neutral-500">v12.0.0-PROD</span>
      </div>
    </div>
  );
}
