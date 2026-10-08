/**
 * @file sponsorship-cockpit.tsx
 * @description React UI Cockpit for Dynamic Sponsorship Valuation & Pitch Engine
 * @layer presentation
 */

'use client';

import React from 'react';
import type {
  ContentNiche,
  SponsorshipRateCard,
} from '@/seed/types/growth-triad-v7-types';

export interface SponsorshipCockpitProps {
  channelName: string;
  niche: ContentNiche;
  expected30dViews: number;
  rateCard: SponsorshipRateCard;
  onGeneratePitch?: (brand: string) => void;
}

export function SponsorshipCockpit({
  channelName,
  niche,
  expected30dViews,
  rateCard,
  onGeneratePitch,
}: SponsorshipCockpitProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-semibold text-amber-400">
            Định giá Tài trợ & Media Kit (Sponsorship Rate Card)
          </h3>
          <p className="text-xs text-slate-400">
            {channelName} &bull; Ngách: <span className="text-slate-200">{niche}</span> &bull; {expected30dViews.toLocaleString()} views/tháng
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/80 font-mono">
          CPM: ${rateCard.effectiveCpmUsd.toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
          <p className="text-slate-400">Video độc quyền (Dedicated):</p>
          <p className="text-xl font-bold text-amber-300 font-mono mt-1">
            ${rateCard.dedicatedVideoUsd.toLocaleString()}
          </p>
        </div>
        <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
          <p className="text-slate-400">Đoạn giữa 60s (Mid-Roll):</p>
          <p className="text-lg font-bold text-slate-200 font-mono mt-1">
            ${rateCard.sixtySecMidRollUsd.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs text-slate-400 px-1">
        <span>30s Pre-Roll: <strong className="text-slate-200 font-mono">${rateCard.thirtySecPreRollUsd.toLocaleString()}</strong></span>
        <span>Shoutout: <strong className="text-slate-200 font-mono">${rateCard.shoutoutOrCommunityUsd.toLocaleString()}</strong></span>
      </div>

      <button
        onClick={() => onGeneratePitch?.('Acme Corp')}
        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium rounded-lg text-xs transition"
      >
        Tạo Email Pitch Nhãn hàng (Pitch Deck)
      </button>
    </div>
  );
}
