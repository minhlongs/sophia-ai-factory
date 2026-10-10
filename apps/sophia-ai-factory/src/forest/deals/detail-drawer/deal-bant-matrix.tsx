'use client';

/**
 * Deal BANT 4-Factor Qualification Matrix Section
 *
 * Layer: forest/deals/detail-drawer
 */

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { EnterpriseDeal } from '@/seed/types/enterprise-deal';

interface DealBantMatrixProps {
  deal: EnterpriseDeal;
}

export function DealBantMatrix({ deal }: DealBantMatrixProps) {
  return (
    <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-zinc-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> BANT Qualification Matrix
        </span>
        <span className="text-base font-bold text-white">{deal.bantScore}/100</span>
      </div>

      <div className="space-y-2.5">
        {/* Budget */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400">
            <span>Budget (ARR &amp; MCU)</span>
            <span className="font-mono text-zinc-200">{deal.bantBudgetScore}/25</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(deal.bantBudgetScore / 25) * 100}%` }}
            />
          </div>
        </div>

        {/* Authority */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400">
            <span>Authority (Role &amp; Domain)</span>
            <span className="font-mono text-zinc-200">{deal.bantAuthorityScore}/25</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(deal.bantAuthorityScore / 25) * 100}%` }}
            />
          </div>
        </div>

        {/* Need */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400">
            <span>Need (Workload &amp; Dubbing)</span>
            <span className="font-mono text-zinc-200">{deal.bantNeedScore}/25</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${(deal.bantNeedScore / 25) * 100}%` }}
            />
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-1">
          <div className="flex justify-between text-zinc-400">
            <span>Timeline (Urgency)</span>
            <span className="font-mono text-zinc-200">{deal.bantTimelineScore}/25</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${(deal.bantTimelineScore / 25) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {deal.bantAnalysis?.recommendation && (
        <p className="p-3 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] leading-relaxed">
          💡 <span className="font-semibold text-zinc-200">AI Next Step:</span> {deal.bantAnalysis.recommendation}
        </p>
      )}
    </div>
  );
}
