/**
 * @file retention-cockpit.tsx
 * @description Presentation component for Kaplan-Meier Viewer Survival Analysis & Drop-Off Heatmap Auto-Trimmer
 * @layer presentation
 */

'use client';

import React from 'react';
import type { RetentionCliff, RetentionTrimStatus } from '@/seed/types/growth-triad-v6-types';

interface RetentionCockpitProps {
  videoId: string;
  thirtySecRetention: number;
  status: RetentionTrimStatus;
  cliffs: RetentionCliff[];
  onApplyTrim?: (videoId: string, cliff: RetentionCliff) => void;
}

export function RetentionCockpit({
  videoId,
  thirtySecRetention,
  status,
  cliffs,
  onApplyTrim,
}: RetentionCockpitProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>📉</span> Survival Retention & Cliff Auto-Trimmer
          </h3>
          <p className="text-xs text-slate-400">
            Ước tính đường cong giữ chân Kaplan-Meier & tự động phát hiện đoạn tụt giảm tỷ lệ xem
          </p>
        </div>
        <span className="text-xs bg-emerald-950 border border-emerald-600 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
          Kaplan-Meier S(t)
        </span>
      </div>

      <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Video ID:</span>
          <span className="text-slate-200 font-mono">{videoId}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
          <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
            <div className="text-slate-400">Tỷ lệ giữ chân 30s:</div>
            <div className="text-base font-bold text-emerald-400 font-mono">
              {(thirtySecRetention * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
            <div className="text-slate-400">Trạng thái nhịp điệu:</div>
            <div className="text-xs font-bold text-amber-400 mt-1">
              {status}
            </div>
          </div>
        </div>

        {cliffs.length > 0 ? (
          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
            <div className="font-semibold text-red-400">Điểm rơi tụt giảm phát hiện (Cliffs):</div>
            {cliffs.map((c, idx) => (
              <div
                key={idx}
                className="bg-red-950/30 border border-red-900/50 p-2.5 rounded flex justify-between items-center"
              >
                <div>
                  <div className="text-slate-200 font-medium">
                    Giây thứ {c.startSecond}s - {c.endSecond}s
                  </div>
                  <div className="text-[11px] text-red-300">
                    Độ sụt giảm: -{(c.dropSeverity * 100).toFixed(1)}%/s | Đề xuất cắt: {c.recommendedTrimSec}s
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyTrim?.(videoId, c)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded text-xs transition"
                >
                  Cắt giảm nhịp
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-emerald-400/80 py-2 text-center bg-emerald-950/20 border border-emerald-900/30 rounded">
            ✓ Không phát hiện điểm sụt giảm bất thường. Nhịp điệu video ổn định!
          </div>
        )}
      </div>
    </div>
  );
}
