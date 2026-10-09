'use client';

/**
 * Deals Admin Dashboard Metrics Summary Banner
 *
 * Layer: forest/deals
 *
 * @module app/components/deals/dashboard/metrics-banner
 */

import React from 'react';
import { DollarSign, Flame, BarChart3, Trophy, Cpu } from 'lucide-react';
import type { EnterpriseDeal } from '@/seed/types/enterprise-deal';

export interface MetricsBannerProps {
  deals: EnterpriseDeal[];
  isVi: boolean;
}

export function MetricsBanner({ deals, isVi }: MetricsBannerProps) {
  const totalValue = deals.reduce((sum, d) => sum + (d.dealValueEstimateCents || 0), 0);
  const hotCount = deals.filter((d) => d.pipelineTier === 'hot').length;
  const wonCount = deals.filter((d) => d.dealStage === 'closed_won').length;
  const avgBant = deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + d.bantScore, 0) / deals.length) : 0;
  const totalMcu = deals.reduce((sum, d) => sum + (d.requestedMcuMonthly || 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{isVi ? 'Tổng Giá Trị Phễu' : 'Pipeline Value'}</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-xl font-bold text-white">${(totalValue / 100).toLocaleString()}</div>
        <div className="text-[11px] text-zinc-500">{deals.length} active enterprise deals</div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{isVi ? 'Deal Nóng (BANT ≥75)' : 'Hot Deals'}</span>
          <Flame className="w-4 h-4 text-rose-400" />
        </div>
        <div className="text-xl font-bold text-rose-400">{hotCount}</div>
        <div className="text-[11px] text-zinc-500">Auto-assigned AI executive</div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{isVi ? 'Điểm BANT Trung Bình' : 'Avg BANT Score'}</span>
          <BarChart3 className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-xl font-bold text-amber-400">{avgBant} / 100</div>
        <div className="text-[11px] text-zinc-500">Deterministic 4-factor</div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{isVi ? 'Đã Chốt (Closed Won)' : 'Closed Won'}</span>
          <Trophy className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-xl font-bold text-purple-400">{wonCount}</div>
        <div className="text-[11px] text-zinc-500">SLA contract active</div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1 col-span-2 md:col-span-1">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{isVi ? 'Dung Lượng Đề Xuất' : 'MCU Capacity'}</span>
          <Cpu className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-xl font-bold text-blue-400">{totalMcu.toLocaleString()}</div>
        <div className="text-[11px] text-zinc-500">Requested MCU/month</div>
      </div>
    </div>
  );
}
