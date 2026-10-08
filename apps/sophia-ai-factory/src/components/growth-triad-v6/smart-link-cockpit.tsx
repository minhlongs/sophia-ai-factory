/**
 * @file smart-link-cockpit.tsx
 * @description Presentation component for Affiliate Smart-Link Yield Engine & Geo Routing
 * @layer presentation
 */

'use client';

import React from 'react';
import type { SmartLinkMatchResult } from '@/seed/types/growth-triad-v6-types';

interface SmartLinkCockpitProps {
  matchResult: SmartLinkMatchResult | null;
  currentNiche: string;
  onOptimize?: (niche: string) => void;
}

export function SmartLinkCockpit({
  matchResult,
  currentNiche,
  onOptimize,
}: SmartLinkCockpitProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>🔗</span> Affiliate Smart-Link Yield Optimizer
          </h3>
          <p className="text-xs text-slate-400">
            Tối ưu hóa sản lượng EPC & điều hướng thông minh đa quốc gia (Zero 404 Fallback)
          </p>
        </div>
        <span className="text-xs bg-indigo-950 border border-indigo-600 text-indigo-400 px-2 py-0.5 rounded-full font-mono">
          Smart Yield Arbitrage
        </span>
      </div>

      <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Ngách nội dung hiện tại:</span>
          <span className="text-slate-200 font-semibold">{currentNiche}</span>
        </div>

        {matchResult ? (
          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Ưu đãi khớp lệnh tốt nhất:</span>
              <span className="text-emerald-400 font-bold">{matchResult.offerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Sản lượng kỳ vọng (Expected Yield):</span>
              <span className="text-amber-400 font-mono font-bold">
                ${matchResult.expectedYieldUsd} / 1k views
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Mạng dự phòng:</span>
              <span className="text-indigo-400">{matchResult.fallbackNetwork}</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate pt-1 font-mono">
              Redirect: {matchResult.geoRoutingUrl}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-3 text-center">
            Chưa có liên kết tối ưu nào được khớp lệnh.
          </div>
        )}

        <button
          type="button"
          onClick={() => onOptimize?.(currentNiche)}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded transition text-xs"
        >
          Tối ưu Smart-Link theo ngách (Optimize Link)
        </button>
      </div>
    </div>
  );
}
