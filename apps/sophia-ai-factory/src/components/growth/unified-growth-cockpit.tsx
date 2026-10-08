'use client';

/**
 * Presentation Layer: Unified Growth Cockpit (Growth Triad v14)
 * Consolidated executive telemetry dashboard for Thompson MAB, Kelly Allocations & Bayesian Early-Halt.
 * Layer: presentation/components/growth | Max LOC: < 200 | Zero :any
 * @module components/growth/unified-growth-cockpit
 */

import React from 'react';
import { PredictiveRenderCard } from './predictive-render-card';
import { useGrowthTelemetry } from './hooks/use-growth-telemetry';
import { PredictiveRenderJob } from '@/seed/types/growth-triad-v14';

export interface UnifiedGrowthCockpitProps {
  initialJobs?: PredictiveRenderJob[];
  fetcher: () => Promise<PredictiveRenderJob[]>;
  locale?: 'vi' | 'en';
}

interface KpiProps {
  isVi: boolean;
  jobCount: number;
  totalMcu: number;
  haltedCount: number;
}

function CockpitKpiRibbon({ isVi, jobCount, totalMcu, haltedCount }: KpiProps) {
  const savingsPct = jobCount > 0 ? `${((haltedCount / jobCount) * 65).toFixed(1)}%` : '0%';
  return (
    <div className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <span className="text-xs text-neutral-400">{isVi ? 'Tổng Render Đang Chạy' : 'Active Jobs'}</span>
        <p className="mt-1 text-2xl font-bold text-white font-mono">{jobCount}</p>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <span className="text-xs text-neutral-400">{isVi ? 'Tổng Ngân Sách Kelly' : 'Allocated MCU'}</span>
        <p className="mt-1 text-2xl font-bold text-amber-400 font-mono">{totalMcu} MCU</p>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <span className="text-xs text-neutral-400">{isVi ? 'Lệnh Dừng Sớm (Bảo toàn)' : 'Early-Halted'}</span>
        <p className="mt-1 text-2xl font-bold text-rose-400 font-mono">{haltedCount}</p>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <span className="text-xs text-neutral-400">{isVi ? 'Tỷ Lệ Tiết Kiệm Dự Kiến' : 'GPU Savings Rate'}</span>
        <p className="mt-1 text-2xl font-bold text-emerald-400 font-mono">{savingsPct}</p>
      </div>
    </div>
  );
}

export function UnifiedGrowthCockpit({
  fetcher,
  locale = 'vi',
}: UnifiedGrowthCockpitProps) {
  const isVi = locale === 'vi';
  const {
    jobs,
    isLoading,
    isError,
    refresh,
    totalAllocatedMcu,
    totalHaltedJobs,
  } = useGrowthTelemetry(fetcher);

  const title = isVi ? 'Trung tâm Tăng trưởng v14 (Kelly & Bayesian Early-Halt)' : 'Growth Triad v14 Executive Cockpit';
  const subtitle = isVi
    ? 'Phân bổ ngân sách Fractional Half-Kelly & cơ chế bảo toàn MCU GPU sớm theo phân phối Beta-Binomial.'
    : 'Fractional Half-Kelly budget allocation & Bayesian Beta-Binomial GPU preservation.';
  const refreshText = isLoading ? (isVi ? 'Đang cập nhật...' : 'Refreshing...') : isVi ? 'Làm mới' : 'Refresh';

  return (
    <div
      data-testid="unified-growth-cockpit"
      className="rounded-2xl border border-amber-500/20 bg-neutral-950/80 p-6 text-neutral-100 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>
        </div>

        <button
          onClick={() => void refresh()}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
        >
          {refreshText}
        </button>
      </div>

      <CockpitKpiRibbon
        isVi={isVi}
        jobCount={jobs.length}
        totalMcu={totalAllocatedMcu}
        haltedCount={totalHaltedJobs}
      />

      {isError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-400">
          {isVi ? 'Lỗi kết nối máy chủ telemetry tăng trưởng.' : 'Failed to connect to growth telemetry backend.'}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-wide text-neutral-300">
          {isVi ? 'Luồng Điều phối Render Thời gian thực' : 'Real-Time Render Execution Stream'}
        </h3>
        {jobs.length === 0 && !isLoading ? (
          <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
            {isVi ? 'Chưa có tác vụ render nào được phân bổ.' : 'No active predictive render jobs.'}
          </div>
        ) : (
          jobs.map((job) => (
            <PredictiveRenderCard key={job.id} job={job} locale={locale} />
          ))
        )}
      </div>
    </div>
  );
}
