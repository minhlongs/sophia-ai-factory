/**
 * @file tiktok-sample-cockpit.tsx
 * @description Presentation component for TikTok Creator Outreach & Sample CRM
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import type { TikTokCreatorRecord } from '@/seed/types/growth-triad-v3-types';

interface TikTokSampleCockpitProps {
  creators: TikTokCreatorRecord[];
  onEvaluateCreator?: (creatorId: string) => void;
}

export function TikTokSampleCockpit({
  creators,
  onEvaluateCreator,
}: TikTokSampleCockpitProps) {
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(
    creators[0]?.id ?? null
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>🎯</span> TikTok Creator Sample Gate & CRM
          </h3>
          <p className="text-xs text-slate-400">
            Automated sample dispatch gate & dynamic commission tier escalator
          </p>
        </div>
        <span className="text-xs bg-indigo-950 border border-indigo-600 text-indigo-400 px-2 py-0.5 rounded-full font-mono">
          Threshold: $5,000 GMV
        </span>
      </div>

      <div className="space-y-3">
        {creators.map((creator) => (
          <div
            key={creator.id}
            onClick={() => setSelectedCreatorId(creator.id)}
            className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
              selectedCreatorId === creator.id
                ? 'bg-slate-950 border-indigo-500/50 ring-1 ring-indigo-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-slate-200">
                {creator.creatorHandle} ({creator.followerCount.toLocaleString()} followers)
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  creator.sampleStatus === 'AUTO_APPROVED'
                    ? 'bg-emerald-900/60 text-emerald-300'
                    : creator.sampleStatus === 'MANUAL_REVIEW'
                    ? 'bg-amber-900/60 text-amber-300'
                    : 'bg-rose-900/60 text-rose-300'
                }`}
              >
                {creator.sampleStatus}
              </span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>
                30d GMV: ${creator.rollingGmv30d.toLocaleString()} | ER: {(creator.engagementRate * 100).toFixed(1)}%
              </span>
              <span className="text-indigo-400 font-medium">
                {creator.commissionTier} ({creator.attributedSalesCount} sales)
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => selectedCreatorId && onEvaluateCreator?.(selectedCreatorId)}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 rounded-lg transition"
      >
        Đánh Giá Sample Gate & Commission
      </button>
    </div>
  );
}
