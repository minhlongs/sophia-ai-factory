/**
 * @file repurpose-cockpit.tsx
 * @description Presentation component for Multi-Platform Viral Repurposer & Adaptive Cropper
 * @layer presentation
 */

'use client';

import React from 'react';
import type { RepurposeTargetFormat } from '@/seed/types/growth-triad-v4-types';

export interface RepurposeItem {
  id: string;
  videoTitle: string;
  sourceDimensions: string;
  targetFormat: RepurposeTargetFormat;
  saliencyHookScore: number;
}

interface RepurposeCockpitProps {
  items: RepurposeItem[];
  onDispatchRepurpose?: (itemId: string) => void;
}

export function RepurposeCockpit({
  items,
  onDispatchRepurpose,
}: RepurposeCockpitProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>✂️</span> Multi-Platform Viral Repurposer
          </h3>
          <p className="text-xs text-slate-400">
            Tự động cắt tiêu điểm Saliency & chuyển đổi tỉ lệ khung hình đa nền tảng
          </p>
        </div>
        <span className="text-xs bg-amber-950 border border-amber-600 text-amber-400 px-2 py-0.5 rounded-full font-mono">
          9:16 / 1:1 Auto Crop
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-slate-200">{item.videoTitle}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                {item.targetFormat}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 mt-2">
              <span>Gốc: {item.sourceDimensions}</span>
              <span className="text-amber-400 font-semibold">
                Saliency Hook: {item.saliencyHookScore}/100
              </span>
            </div>
            {onDispatchRepurpose && (
              <button
                onClick={() => onDispatchRepurpose(item.id)}
                className="mt-2 w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded font-semibold text-[11px] transition"
              >
                Cắt & Đóng gói Video →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
