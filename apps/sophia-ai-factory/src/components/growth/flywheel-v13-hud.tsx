'use client';

/**
 * Presentation Layer: Growth Triad v13 Executive HUD Card
 * Real-time Thompson MAB Split Weights, Creative Deliberation Verdicts & Shapley ROAS
 * Layer: presentation/components/growth | Max LOC: < 200 | Zero :any
 * @module components/growth/flywheel-v13-hud
 */

import React, { useState } from 'react';

export interface FlywheelV13Stats {
  activeExperiments: number;
  convergedExperiments: number;
  deliberationPassRatePct: number;
  totalAttributedRevenueUsd: number;
  overallShapleyRoas: number;
}

export interface FlywheelV13HudProps {
  stats: FlywheelV13Stats;
  locale?: string;
  onRefresh?: () => Promise<void> | void;
}

export function FlywheelV13Hud({ stats, locale = 'vi', onRefresh }: FlywheelV13HudProps) {
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
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              {isVi ? 'Hệ thống Tối ưu hóa Tăng trưởng (Growth Triad v13)' : 'Growth Triad v13 Cockpit'}
            </h2>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            {isVi
              ? 'Tối ưu A/B Bandit Thompson Sampling, Hội đồng Thẩm định Kịch bản & Sổ cái Phân bổ Lợi nhuận Shapley.'
              : 'Thompson Multi-Armed Bandit, 3-Lens Creative Deliberation & Shapley Multi-Touch Profit Ledger.'}
          </p>
        </div>

        <button
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition-all hover:bg-amber-500/20 disabled:opacity-50"
        >
          {isRefreshing ? (isVi ? 'Đang đồng bộ...' : 'Syncing...') : isVi ? 'Làm mới Chỉ số' : 'Sync Telemetry'}
        </button>
      </div>

      {/* KPI Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* KPI 1: Active Experiments */}
        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {isVi ? 'Thử nghiệm MAB Đang chạy' : 'Active MAB Tests'}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400">{stats.activeExperiments}</span>
            <span className="text-xs text-neutral-500">({stats.convergedExperiments} {isVi ? 'đã hội tụ' : 'converged'})</span>
          </div>
        </div>

        {/* KPI 2: Deliberation Approval Rate */}
        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {isVi ? 'Tỷ lệ Duyệt Kịch bản (3 Thấu kính)' : 'Deliberation Pass Rate'}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">{stats.deliberationPassRatePct}%</span>
            <span className="text-xs text-neutral-500">{isVi ? 'tiết kiệm GPU' : 'GPU guarded'}</span>
          </div>
        </div>

        {/* KPI 3: Attributed Gross Revenue */}
        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {isVi ? 'Doanh thu Ghi nhận (Shapley)' : 'Attributed Gross'}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">
              ${stats.totalAttributedRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* KPI 4: Shapley Overall ROAS */}
        <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {isVi ? 'ROAS Ròng Sau Chi phí MCU' : 'Shapley Unit ROAS'}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">{stats.overallShapleyRoas}x</span>
            <span className="text-xs text-neutral-500">{isVi ? 'trên chi phí render' : 'net profit'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
