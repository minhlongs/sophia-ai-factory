/**
 * @file ad-arbitrage-cockpit.tsx
 * @description Presentation component for Ad Arbitrage MAB Thompson Sampling
 */

'use client';

import React from 'react';
import type { AdArbitrageCampaign } from '@/seed/types/growth-triad-v2-types';

interface AdArbitrageCockpitProps {
  campaigns: AdArbitrageCampaign[];
  onRebalance?: (campaignId: string) => void;
}

export function AdArbitrageCockpit({ campaigns, onRebalance }: AdArbitrageCockpitProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2">
            <span>📊</span> Ad Arbitrage MAB (Thompson Sampling)
          </h3>
          <p className="text-xs text-slate-400">Tự động cân bằng ngân sách & cắt lỗ CPA theo thời gian thực</p>
        </div>
        <span className="text-xs bg-indigo-950 border border-indigo-600 text-indigo-400 px-2 py-0.5 rounded-full font-mono">
          Auto Stop-Loss Active
        </span>
      </div>

      <div className="space-y-3">
        {campaigns.map((camp) => (
          <div key={camp.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-200">{camp.campaignName}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  camp.recommendedAction === 'SCALE_BUDGET'
                    ? 'bg-emerald-900/60 text-emerald-300'
                    : camp.recommendedAction === 'PAUSE_STOP_LOSS'
                    ? 'bg-rose-900/60 text-rose-300'
                    : 'bg-indigo-900/60 text-indigo-300'
                }`}
              >
                {camp.recommendedAction}
              </span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>24h ROAS: <strong className="text-emerald-400">{camp.roas.toFixed(2)}x</strong></span>
              <span>CPA: {camp.cpa.toLocaleString()} VND</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Budget: {camp.dailyBudget.toLocaleString()} VND/ngày</span>
              <span>Spend: {camp.rollingSpend24h.toLocaleString()} VND</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => campaigns[0] && onRebalance?.(campaigns[0].id)}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 rounded-lg transition"
      >
        Rebalance Budget Toàn Bộ Campaign
      </button>
    </div>
  );
}
