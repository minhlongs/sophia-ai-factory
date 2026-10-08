/**
 * @file ab-testing-cockpit.tsx
 * @description Presentation component for AI Dynamic Thumbnail & Hook A/B Auto-Tester
 * @layer presentation
 */

'use client';

import React from 'react';
import type { AbVariant } from '@/seed/types/growth-triad-v5-types';

interface AbTestingCockpitProps {
  experimentId: string;
  title: string;
  status: string;
  variants: AbVariant[];
  onEvaluate?: (experimentId: string) => void;
}

export function AbTestingCockpit({
  experimentId,
  title,
  status,
  variants,
  onEvaluate,
}: AbTestingCockpitProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>🔬</span> Bayesian Hook A/B Auto-Tester
          </h3>
          <p className="text-xs text-slate-400">
            Ước lượng hậu nghiệm Beta-Binomial & kiểm định Chi-Square ngăn ngừa dừng sớm (peeking error)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
            Trạng thái: <b className="text-amber-400">{status}</b>
          </span>
          <button
            type="button"
            onClick={() => onEvaluate?.(experimentId)}
            className="text-xs px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded transition"
          >
            Đánh giá & Thăng hạng
          </button>
        </div>
      </div>

      <div className="text-xs text-slate-300 font-medium">{title}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {variants.map((v) => {
          const ctr = v.impressions > 0
            ? ((v.clicks / v.impressions) * 100).toFixed(2)
            : '0.00';

          return (
            <div
              key={v.id}
              className={`p-3.5 rounded-lg border text-xs space-y-2 transition ${
                v.isPromotedWinner
                  ? 'bg-amber-950/20 border-amber-500/60 ring-1 ring-amber-500/40'
                  : v.isControl
                  ? 'bg-slate-950/70 border-slate-700'
                  : 'bg-slate-950/50 border-slate-800'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200">{v.name}</span>
                  {v.isControl && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                      Control
                    </span>
                  )}
                  {v.isPromotedWinner && (
                    <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded font-mono">
                      WINNER 🏆
                    </span>
                  )}
                </div>
                <span className="text-emerald-400 font-mono font-bold">{ctr}% CTR</span>
              </div>

              <p className="text-slate-400 italic text-[11px] bg-slate-900/60 p-2 rounded border border-slate-800/80">
                &ldquo;{v.hookText}&rdquo;
              </p>

              <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-1">
                <span>Hiển thị: {v.impressions.toLocaleString()}</span>
                <span>Click: {v.clicks.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
