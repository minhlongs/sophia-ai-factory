/**
 * @file reframer-cockpit.tsx
 * @description React UI Cockpit for Saliency Video Re-Framing & Kinetic Subtitles
 * @layer presentation
 */

'use client';

import React from 'react';
import type { ReframeJobOutput } from '@/seed/types/growth-triad-v7-types';

export interface ReframerCockpitProps {
  reframeResult: ReframeJobOutput;
  onRender?: () => void;
}

export function ReframerCockpit({
  reframeResult,
  onRender,
}: ReframerCockpitProps) {
  const isSmooth = reframeResult.jitterScore < 0.15;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-semibold text-indigo-400">
            Chuyển đổi Khung hình 9:16 (Saliency Re-Framer)
          </h3>
          <p className="text-xs text-slate-400">
            {reframeResult.sourceAspect} &rarr; {reframeResult.targetAspect} &bull; Video ID: {reframeResult.videoId}
          </p>
        </div>
        <span
          className={`px-2.5 py-1 text-xs rounded-full font-mono border ${
            isSmooth
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
              : 'bg-amber-950/60 text-amber-300 border-amber-800/80'
          }`}
        >
          Độ mượt (Jitter): {reframeResult.jitterScore}
        </span>
      </div>

      <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg space-y-2 text-xs">
        <div className="flex justify-between text-slate-300">
          <span>Khung hình đã xử lý (Keyframes):</span>
          <span className="font-mono text-indigo-300">{reframeResult.cropWindows.length} keyframes</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Phụ đề động (Kinetic Tokens):</span>
          <span className="font-mono text-emerald-400">{reframeResult.tokens.length} từ đồng bộ</span>
        </div>
      </div>

      <button
        onClick={onRender}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs transition"
      >
        Xuất Video Dọc Shorts / TikTok (Export 9:16)
      </button>
    </div>
  );
}
