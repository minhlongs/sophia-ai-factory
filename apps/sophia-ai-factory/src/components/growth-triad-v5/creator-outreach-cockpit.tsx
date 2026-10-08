/**
 * @file creator-outreach-cockpit.tsx
 * @description Presentation component for Creator Recruitment & High-Conversion Outreach Pipeline
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import type { KolLeadRecord } from '@/seed/types/growth-triad-v5-types';

interface CreatorOutreachCockpitProps {
  creators: KolLeadRecord[];
  onEnroll?: (handle: string, platform: string) => void;
}

export function CreatorOutreachCockpit({
  creators,
  onEnroll,
}: CreatorOutreachCockpitProps) {
  const [filterPlatform, setFilterPlatform] = useState<string>('ALL');

  const filtered = filterPlatform === 'ALL'
    ? creators
    : creators.filter((c) => c.platform === filterPlatform);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>🎯</span> Creator Recruitment & FSM Outreach Pipeline
          </h3>
          <p className="text-xs text-slate-400">
            Lọc tự động ER 3-18%, tuân thủ RFC 8058 One-Click Unsubscribe & đàm phán tỷ lệ chia hoa hồng Sigmoid
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['ALL', 'TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setFilterPlatform(p)}
              className={`text-[10px] px-2 py-0.5 rounded font-mono transition ${
                filterPlatform === p
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((creator) => {
          const splitPct = (creator.currentSplitPct * 100).toFixed(0);
          return (
            <div
              key={creator.id}
              className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between text-xs hover:border-slate-700 transition"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{creator.handle}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                    {creator.platform}
                  </span>
                  <span className="text-[10px] bg-indigo-950 border border-indigo-700 text-indigo-300 px-1.5 py-0.2 rounded font-mono">
                    {creator.status}
                  </span>
                </div>
                <div className="flex gap-4 text-[11px] text-slate-400">
                  <span>Theo dõi: <b className="text-slate-300 font-mono">{creator.followerCount.toLocaleString()}</b></span>
                  <span>Lượt xem TB: <b className="text-slate-300 font-mono">{creator.medianViews.toLocaleString()}</b></span>
                  <span>Tương tác (ER): <b className="text-amber-400 font-mono">{creator.engagementRate.toFixed(2)}%</b></span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-indigo-400 font-mono font-bold">{splitPct}% hoa hồng</div>
                  <div className="text-[10px] text-slate-500">Điểm chất lượng: {creator.qualityScore.toFixed(0)}/100</div>
                </div>
                {creator.status === 'SCOUTED' && (
                  <button
                    type="button"
                    onClick={() => onEnroll?.(creator.handle, creator.platform)}
                    className="px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded transition"
                  >
                    Gửi Outreach
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
