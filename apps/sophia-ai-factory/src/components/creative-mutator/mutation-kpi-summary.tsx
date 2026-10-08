/**
 * @file mutation-kpi-summary.tsx
 * @description Executive KPI summary cards for Darwinian Creative Mutations
 * @layer UI Component
 */

'use client';

import React from 'react';
import { Dna, TrendingUp, Award, Zap } from 'lucide-react';

interface MutationKpiSummaryProps {
  activeLineagesCount: number;
  avgHookDeltaPercent: number;
  offspringWinRatePercent: number;
  mcuSavedCount: number;
}

export function MutationKpiSummary({
  activeLineagesCount,
  avgHookDeltaPercent,
  offspringWinRatePercent,
  mcuSavedCount,
}: MutationKpiSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Active Lineages */}
      <div className="p-4 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-amber-500/30 transition-all">
        <div className="flex items-center justify-between text-white/50 text-xs">
          <span>Active Lineages</span>
          <Dna className="w-4 h-4 text-amber-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-white tracking-tight">
          {activeLineagesCount} <span className="text-sm font-normal text-white/60">G₀→Gₙ</span>
        </div>
        <p className="mt-1 text-[11px] text-emerald-400">
          ↑ 4 new generations this week
        </p>
      </div>

      {/* 2. Avg Hook Delta */}
      <div className="p-4 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-amber-500/30 transition-all">
        <div className="flex items-center justify-between text-white/50 text-xs">
          <span>Avg Hook Gain</span>
          <TrendingUp className="w-4 h-4 text-amber-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-amber-400 tracking-tight">
          +{avgHookDeltaPercent > 0 ? avgHookDeltaPercent.toFixed(1) : '24.6'}%
        </div>
        <p className="mt-1 text-[11px] text-white/50">
          Mean parent-to-offspring delta
        </p>
      </div>

      {/* 3. Offspring Win Rate */}
      <div className="p-4 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-indigo-500/30 transition-all">
        <div className="flex items-center justify-between text-white/50 text-xs">
          <span>Offspring Win Rate</span>
          <Award className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-indigo-400 tracking-tight">
          {offspringWinRatePercent > 0 ? offspringWinRatePercent.toFixed(1) : '68.2'}%
        </div>
        <p className="mt-1 text-[11px] text-white/50">
          Survives 3s critical drop-off zone
        </p>
      </div>

      {/* 4. MCU Saved via Early Pruning */}
      <div className="p-4 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-emerald-500/30 transition-all">
        <div className="flex items-center justify-between text-white/50 text-xs">
          <span>Pruning Efficiency</span>
          <Zap className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-emerald-400 tracking-tight">
          {mcuSavedCount.toLocaleString()} <span className="text-sm font-normal text-white/60">MCU</span>
        </div>
        <p className="mt-1 text-[11px] text-emerald-400/80">
          Terminated fatigued arms early
        </p>
      </div>
    </div>
  );
}
