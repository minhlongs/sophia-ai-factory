'use client';

/**
 * @file metric-cards.tsx
 * @description Milestone metric cards for MRR, customers, ARPU, and velocity.
 * @layer forest
 */

import React from 'react';
import { DollarSign, Users, TrendingUp, Zap } from 'lucide-react';
import type { GrowthAnalyticsSummary } from '@/seed/types/solutions-types';

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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/40 transition">
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">
            {isVi ? 'Doanh Thu TB / Khách (ARPU)' : 'Average Revenue (ARPU)'}
          </span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white tracking-tight">
            ${mrrProgress.arpu}
          </span>
          <span className="text-sm font-medium text-zinc-400">
            / {isVi ? 'tháng' : 'month'}
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-4">
          {isVi
            ? 'Tỉ trọng: Starter ($199), Growth ($399), Premium ($799).'
            : 'Weighted across Starter ($199), Growth ($399), Premium ($799).'}
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
          <Zap className="w-3.5 h-3.5" />
          <span>{isVi ? 'Lợi nhuận gộp biên độ cao' : 'High-margin SaaS profile'}</span>
        </div>
      </div>

      {/* Metric Card 4: Radial Runway Velocity */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm relative overflow-hidden group hover:border-cyan-500/40 transition flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            {isVi ? 'Tốc Độ Cán Đích $5K' : 'Runway Velocity'}
          </span>
          <div className="text-2xl font-bold text-white">
            {mrrProgress.runwayVelocityPct}%
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-[130px]">
            {isVi ? 'Dựa trên tốc độ chuyển đổi tuần qua' : 'Based on 30-day cohort run rate'}
          </p>
        </div>

        <div className="relative w-18 h-18 flex items-center justify-center">
          <svg className="w-18 h-18 transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-zinc-800"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-cyan-400 transition-all duration-700"
              strokeDasharray={`${Math.min(100, mrrProgress.runwayVelocityPct)}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute text-[11px] font-bold text-white">
            {mrrProgress.runwayVelocityPct}%
          </div>
        </div>
      </div>
    </div>
  );
}
