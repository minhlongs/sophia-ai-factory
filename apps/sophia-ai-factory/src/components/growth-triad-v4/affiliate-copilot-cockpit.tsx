/**
 * @file affiliate-copilot-cockpit.tsx
 * @description Presentation component for High-Velocity Affiliate Co-Pilot & Dynamic Matcher
 * @layer presentation
 */

'use client';

import React from 'react';
import type { AffiliateTier } from '@/seed/types/growth-triad-v4-types';

export interface CampaignEpcCardData {
  campaignId: string;
  campaignTitle: string;
  clicks7d: number;
  grossRevenueUsd: number;
  calculatedEpc: number;
  tier: AffiliateTier;
}

interface AffiliateCopilotCockpitProps {
  campaigns: CampaignEpcCardData[];
  onBoostCommission?: (campaignId: string) => void;
}

export function AffiliateCopilotCockpit({
  campaigns,
  onBoostCommission,
}: AffiliateCopilotCockpitProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>📈</span> High-Velocity Affiliate Co-Pilot
          </h3>
          <p className="text-xs text-slate-400">
            Theo dõi rolling 7d EPC & tự động tăng bậc hoa hồng theo doanh thu
          </p>
        </div>
        <span className="text-xs bg-indigo-950 border border-indigo-600 text-indigo-400 px-2 py-0.5 rounded-full font-mono">
          Dynamic Tier Escalator
        </span>
      </div>

      <div className="space-y-3">
        {campaigns.map((camp) => (
          <div
            key={camp.campaignId}
            className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-slate-200">{camp.campaignTitle}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/40">
                {camp.tier}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
              <div>Clicks: {camp.clicks7d}</div>
              <div>Doanh thu: ${camp.grossRevenueUsd}</div>
              <div className="text-emerald-400 font-bold">
                EPC: ${camp.calculatedEpc.toFixed(2)}
              </div>
            </div>
            {onBoostCommission && (
              <button
                onClick={() => onBoostCommission(camp.campaignId)}
                className="mt-2 text-indigo-400 hover:underline font-semibold text-[11px]"
              >
                Nâng hạng phân phối Sub-ID →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
