'use client';

/**
 * Presentation Layer: Predictive Render Job Card
 * Obsidian Cyber-Glass telemetry card displaying Kelly allocation & early-halt probability.
 * Layer: presentation/components/growth | Max LOC: < 200 | Zero :any
 * @module components/growth/predictive-render-card
 */

import React from 'react';
import { PredictiveRenderJob } from '@/seed/types/growth-triad-v14';

export interface PredictiveRenderCardProps {
  job: PredictiveRenderJob;
  locale?: 'vi' | 'en';
}

export function PredictiveRenderCard({ job, locale = 'vi' }: PredictiveRenderCardProps) {
  const isVi = locale === 'vi';

  const statusColors = {
    QUEUED: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    STAGE_1_RENDERING: 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse',
    HALTED_EARLY: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    FAILED: 'bg-red-900/20 text-red-400 border-red-700',
  };

  return (
    <div
      data-testid="predictive-render-card"
      className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-4 backdrop-blur-md transition-all hover:border-amber-500/30"
    >
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <span className="text-xs font-mono text-neutral-400">ID: {job.id}</span>
          <h4 className="text-sm font-semibold text-neutral-100">{job.scriptId}</h4>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            statusColors[job.status]
          }`}
        >
          {job.status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div>
          <span className="text-neutral-400">{isVi ? 'Phân bổ Kelly' : 'Kelly Share'}</span>
          <p className="font-mono text-sm font-bold text-amber-400">
            {(job.kellyAllocationFraction * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <span className="text-neutral-400">{isVi ? 'Ngân sách MCU' : 'MCU Budget'}</span>
          <p className="font-mono text-sm font-bold text-neutral-200">
            {job.allocatedMcu} MCU
          </p>
        </div>
        <div>
          <span className="text-neutral-400">{isVi ? 'Điểm Thẩm định' : 'Deliberation'}</span>
          <p className="font-mono text-sm font-bold text-neutral-200">
            {job.deliberationScore}/100
          </p>
        </div>
        <div>
          <span className="text-neutral-400">{isVi ? 'Xác suất Dừng Sớm' : 'Halt Survival'}</span>
          <p
            className={`font-mono text-sm font-bold ${
              job.earlyHaltProbability && job.earlyHaltProbability < 0.25
                ? 'text-rose-400'
                : 'text-emerald-400'
            }`}
          >
            {job.earlyHaltProbability ? `${(job.earlyHaltProbability * 100).toFixed(1)}%` : 'N/A'}
          </p>
        </div>
      </div>

      {job.haltReason && (
        <div className="mt-3 rounded bg-rose-950/30 border border-rose-900/50 p-2 text-xs text-rose-300">
          <span className="font-semibold">{isVi ? 'Lý do Dừng:' : 'Halt Reason:'}</span> {job.haltReason}
        </div>
      )}
    </div>
  );
}
