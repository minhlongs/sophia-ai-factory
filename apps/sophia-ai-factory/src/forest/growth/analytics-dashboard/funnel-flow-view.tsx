'use client';

/**
 * @file funnel-flow-view.tsx
 * @description 4-Stage visual conversion funnel section with stage filtering.
 * @layer forest
 */

import React from 'react';
import { Layers } from 'lucide-react';
import type { FunnelStageKey, GrowthAnalyticsSummary } from '@/seed/types/solutions-types';

interface FunnelFlowViewProps {
  funnelStages: GrowthAnalyticsSummary['funnelStages'];
  activeStageFilter: FunnelStageKey | 'all';
  setActiveStageFilter: (stage: FunnelStageKey | 'all') => void;
  isVi: boolean;
}

export function FunnelFlowView({
  funnelStages,
  activeStageFilter,
  setActiveStageFilter,
  isVi,
}: FunnelFlowViewProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800/80 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">
              {isVi ? 'Phễu Chuyển Đổi Doanh Thu 4 Giai Đoạn' : '4-Stage Omnichannel Conversion Funnel'}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {isVi
              ? 'Đo lường từng điểm chạm từ tiếp cận người xem đến chốt hợp đồng trả phí trên Cloudflare D1.'
              : 'Direct measurement from initial view impression to paid activation recorded in D1.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">
            {isVi ? 'Lọc theo giai đoạn:' : 'Filter stage:'}
          </span>
          <div className="inline-flex rounded-lg bg-zinc-800/80 p-0.5 border border-zinc-700/60 text-xs">
            {(['all', 'leads', 'trials', 'paid'] as const).map((stage) => (
              <button
                key={stage}
                onClick={() => setActiveStageFilter(stage)}
                className={`px-3 py-1 rounded-md transition font-medium capitalize ${
                  activeStageFilter === stage
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {funnelStages.map((stage, idx) => {
          const isFirst = idx === 0;
          const stageColors = [
            'border-blue-500/30 bg-blue-500/5',
            'border-amber-500/30 bg-amber-500/5',
            'border-purple-500/30 bg-purple-500/5',
            'border-emerald-500/30 bg-emerald-500/5',
          ];
          const badgeColors = [
            'bg-blue-500/10 text-blue-400',
            'bg-amber-500/10 text-amber-400',
            'bg-purple-500/10 text-purple-400',
            'bg-emerald-500/10 text-emerald-400',
          ];

          return (
            <div
              key={stage.stage}
              className={`rounded-xl border ${stageColors[idx]} p-5 relative flex flex-col justify-between transition-all hover:scale-[1.01]`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeColors[idx]}`}>
                    Stage {idx + 1}
                  </span>
                  {!isFirst && (
                    <span className="text-xs font-semibold text-emerald-400">
                      {stage.conversionRateFromPrev}% CR
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-zinc-200">
                  {isVi ? stage.labelVi : stage.labelEn}
                </h3>

                <div className="mt-4 text-3xl font-extrabold text-white tracking-tight">
                  {stage.count.toLocaleString()}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800/60 text-xs flex justify-between items-center text-zinc-400">
                <span>{isVi ? 'Tỉ lệ rớt khách (Drop-off):' : 'Stage Drop-off:'}</span>
                <span className={`font-medium ${stage.dropoffRateFromPrev > 50 ? 'text-rose-400' : 'text-zinc-300'}`}>
                  {stage.dropoffRateFromPrev}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
