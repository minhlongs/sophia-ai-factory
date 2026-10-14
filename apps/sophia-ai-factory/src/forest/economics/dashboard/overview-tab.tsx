/**
 * Unit Economics Dashboard Submodule: Overview Tab.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/overview-tab
 */

import React from 'react';
import { BarChart3, Sparkles } from 'lucide-react';
import type { UnitEconomicsSummary } from '@/seed/types/unit-economics-types';
import { ArbitrageMatrixCard, MekongEdgeStatusCard } from './overview-sections';

interface OverviewTabProps {
  data: UnitEconomicsSummary;
  locale: 'vi' | 'en';
}

export function OverviewTab({ data, locale }: OverviewTabProps) {
  const isVi = locale === 'vi';
  const { metrics, ltvCacMetrics } = data;

  return (
    <div className="space-y-8">
      <ArbitrageMatrixCard isVi={isVi} />

      {/* Section: LTV : CAC Unit Economics Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            {isVi ? 'Phân Tích Chỉ Số LTV:CAC & Hoàn Vốn' : 'LTV:CAC & Payback Analysis'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60">
              <span className="text-xs text-zinc-400">{isVi ? 'Doanh Thu TB (ARPU)' : 'ARPU'}</span>
              <div className="text-xl font-bold text-zinc-100 mt-1">${ltvCacMetrics.arpuUsd}</div>
              <span className="text-[11px] text-zinc-500">{isVi ? '/tháng /khách' : '/mo /client'}</span>
            </div>
            <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60">
              <span className="text-xs text-zinc-400">{isVi ? 'Tỷ Lệ Rời Bỏ (Churn)' : 'Monthly Churn'}</span>
              <div className="text-xl font-bold text-amber-400 mt-1">{ltvCacMetrics.estimatedMonthlyChurnPct}%</div>
              <span className="text-[11px] text-zinc-500">{isVi ? 'ước tính ổn định' : 'estimated stable'}</span>
            </div>
            <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60">
              <span className="text-xs text-zinc-400">{isVi ? 'Thời Gian Hoàn Vốn' : 'Payback Period'}</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {ltvCacMetrics.estimatedPaybackPeriodMonths} {isVi ? 'tháng' : 'mo'}
              </div>
              <span className="text-[11px] text-zinc-500">{isVi ? 'chu kỳ thu hồi vốn' : 'capital recovery'}</span>
            </div>
            <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60">
              <span className="text-xs text-zinc-400">{isVi ? 'Khách Giới Thiệu' : 'Affiliate CAC'}</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                ${ltvCacMetrics.affiliateCommissionCogsUsd.toLocaleString()}
              </div>
              <span className="text-[11px] text-zinc-500">{isVi ? 'hoa hồng đã trích' : 'commission held'}</span>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-300 leading-relaxed">
              {isVi
                ? `Sophia AI Factory đang đạt tỷ lệ LTV:CAC là ${metrics.ltvCacRatio}x (cao hơn chuẩn lành mạnh SaaS 3.0x). Với thời gian hoàn vốn ${ltvCacMetrics.estimatedPaybackPeriodMonths} tháng và biên lợi nhuận gộp ${metrics.grossMarginPct}%, mỗi khách hàng mới đóng góp giá trị thặng dư ròng ổn định.`
                : `Sophia AI Factory operates at an outstanding ${metrics.ltvCacRatio}x LTV:CAC ratio (well above the 3.0x SaaS health benchmark). With a ${ltvCacMetrics.estimatedPaybackPeriodMonths}-month payback period and ${metrics.grossMarginPct}% gross margin, new clients generate strong compound net cash flow.`}
            </p>
          </div>
        </div>

        <MekongEdgeStatusCard isVi={isVi} />
      </div>
    </div>
  );
}
