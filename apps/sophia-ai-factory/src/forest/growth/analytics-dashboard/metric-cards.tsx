'use client';

/**
 * @file metric-cards.tsx
 * @description Milestone metric cards for MRR, customers, ARPU, and velocity.
 * @layer forest
 */

import React from 'react';
import { DollarSign, Users } from 'lucide-react';
import type { GrowthAnalyticsSummary } from '@/seed/types/solutions-types';
import { ArpuMetricCard, RunwayVelocityMetricCard } from './metric-secondary-cards';

interface MilestoneMetricCardsProps {
  mrrProgress: GrowthAnalyticsSummary['mrrProgress'];
  isVi: boolean;
}

export function MilestoneMetricCards({ mrrProgress, isVi }: MilestoneMetricCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Metric Card 1: MRR Milestone */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/40 transition">
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">
            {isVi ? 'Cột Mốc Doanh Thu MRR' : 'MRR Milestone Goal'}
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white tracking-tight">
            ${mrrProgress.currentMrrUsd.toLocaleString()}
          </span>
          <span className="text-sm font-medium text-zinc-400">
            / ${mrrProgress.targetMrrUsd.toLocaleString()}
          </span>
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-zinc-400">{isVi ? 'Tiến độ' : 'Progress'}</span>
            <span className="text-emerald-400 font-semibold">{mrrProgress.progressPct}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, mrrProgress.progressPct)}%` }}
            />
          </div>
          <div className="text-[11px] text-zinc-500 flex justify-between pt-1">
            <span>{isVi ? 'Còn thiếu:' : 'Remaining gap:'} ${mrrProgress.gapToTargetUsd.toLocaleString()}</span>
            <span>{isVi ? 'Mục tiêu: $5K' : 'Target: $5K'}</span>
          </div>
        </div>
      </div>

      {/* Metric Card 2: 10 Paying Customers Milestone */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm relative overflow-hidden group hover:border-violet-500/40 transition">
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">
            {isVi ? 'Mục Tiêu 10 Khách Trả Phí' : 'First 10 Customers'}
          </span>
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white tracking-tight">
            {mrrProgress.currentPayingCustomers}
          </span>
          <span className="text-sm font-medium text-zinc-400">
            / {mrrProgress.targetPayingCustomers} {isVi ? 'khách' : 'active'}
          </span>
        </div>

        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-zinc-400">{isVi ? 'Tiến độ' : 'Progress'}</span>
            <span className="text-violet-400 font-semibold">
              {mrrProgress.customerProgressPct}%
            </span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-violet-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, mrrProgress.customerProgressPct)}%` }}
            />
          </div>
          <div className="text-[11px] text-zinc-500 flex justify-between pt-1">
            <span>{isVi ? 'Còn lại:' : 'Remaining:'} {mrrProgress.customerGap} {isVi ? 'khách' : 'users'}</span>
            <span>10 Customers Goal</span>
          </div>
        </div>
      </div>

      {/* Metric Card 3: ARPU */}
      <ArpuMetricCard mrrProgress={mrrProgress} isVi={isVi} />

      {/* Metric Card 4: Radial Runway Velocity */}
      <RunwayVelocityMetricCard mrrProgress={mrrProgress} isVi={isVi} />
    </div>
  );
}
