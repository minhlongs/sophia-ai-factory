/**
 * @file split-test-attribution-card.tsx
 * @description Hook A vs Hook B Split-Test Attribution & Auto-Cut Cockpit Card
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import { GitCompare, TrendingUp, Scissors, Award } from 'lucide-react';

export const SplitTestAttributionCard: React.FC = () => {
  const [winner, setWinner] = useState<'HOOK_A' | 'HOOK_B' | 'NONE'>('HOOK_A');

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold text-base text-foreground">Split-Test & Auto-Cut</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
          <Award className="h-3 w-3" />
          {winner === 'HOOK_A' ? 'HOOK A WINNING' : 'AUTO-CUT ACTIVE'}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2.5 text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-emerald-500">Hook A (Hỏi Sốc):</span>
            <p className="text-muted-foreground">CR: 3.5% &bull; Net ROI: +240%</p>
          </div>
          <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-bold rounded text-[10px]">100% Traffic</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-rose-500/5 border border-rose-500/20 p-2.5 text-xs opacity-75">
          <div className="space-y-0.5">
            <span className="font-bold text-rose-500">Hook B (Kể Chuyện):</span>
            <p className="text-muted-foreground">CR: 0.2% &bull; Kém hiệu quả</p>
          </div>
          <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 font-semibold rounded text-[10px] flex items-center gap-1">
            <Scissors className="h-2.5 w-2.5" /> Dừng ads
          </span>
        </div>

        <button
          type="button"
          onClick={() => setWinner('HOOK_A')}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Tái Cân Bằng Traffic & Khóa Ngân Sách
        </button>
      </div>
    </div>
  );
};
