/**
 * Unit Economics Dashboard Submodule: Hero KPI Cards.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/hero-kpi-cards
 */

import React from 'react';
import { TrendingUp, Zap, DollarSign, Cpu } from 'lucide-react';
import type { UnitEconomicsSummary } from '@/seed/types/unit-economics-types';

interface HeroKpiCardsProps {
  data: UnitEconomicsSummary;
  locale: 'vi' | 'en';
}

export function HeroKpiCards({ data, locale }: HeroKpiCardsProps) {
  const isVi = locale === 'vi';
  const { metrics } = data;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* KPI 1: Gross Margin % */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-emerald-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {isVi ? 'Biên Lợi Nhuận Gộp' : 'Platform Gross Margin'}
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400">
            {metrics.grossMarginPct}%
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
            {metrics.grossMarginPct >= 75
              ? isVi
                ? 'Tối Ưu'
                : 'Optimal'
              : isVi
                ? 'Đạt Chuẩn'
                : 'Healthy'}
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {isVi ? 'Doanh thu:' : 'Revenue:'} ${metrics.totalRevenueUsd.toLocaleString()} | COGS: ${metrics.totalCogsUsd.toLocaleString()}
        </p>
      </div>

      {/* KPI 2: COGS per Video */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-cyan-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-all">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {isVi ? 'Giá Vốn Mỗi Video' : 'COGS Per Video'}
          </span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-cyan-400">
            ${metrics.cogsPerVideoUsd.toFixed(4)}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
            {metrics.cogsPerVideoUsd < 0.1 ? (isVi ? 'Cực Thấp' : 'Ultra-Low') : 'Standard'}
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {isVi ? 'Tổng sản lượng:' : 'Total Completed:'} {data.totalVideosCompleted.toLocaleString()}{' '}
          {isVi ? 'video' : 'videos'}
        </p>
      </div>

      {/* KPI 3: LTV:CAC Ratio */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-indigo-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition-all">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {isVi ? 'Tỷ Lệ LTV : CAC' : 'LTV : CAC Ratio'}
          </span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-indigo-400">
            {metrics.ltvCacRatio}x
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
            {metrics.ltvCacRatio >= 3.0 ? (isVi ? 'Xuất Sắc' : 'Outstanding') : 'Target'}
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          LTV: ${metrics.ltvUsd.toLocaleString()} | CAC: ${metrics.cacUsd.toLocaleString()}
        </p>
      </div>

      {/* KPI 4: Mekong GPU Edge Savings */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {isVi ? 'Tiết Kiệm Mekong GPU' : 'Mekong GPU Savings'}
          </span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-amber-400">
            ${data.edgeNodeSavingsUsd.toLocaleString()}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
            {data.activeEdgeNodes} {isVi ? 'Nút Online' : 'Nodes Active'}
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {isVi ? 'Chi phí biên:' : 'Marginal Cost:'} $0.00 unmetered local edge
        </p>
      </div>
    </div>
  );
}
