/**
 * @file thumbnail-cockpit.tsx
 * @description React UI Cockpit for Visual Saliency & Thumbnail CTR Gaze Predictor
 * @layer presentation
 */

'use client';

import React from 'react';
import type { SaliencyReport } from '@/seed/types/growth-triad-v7-types';

export interface ThumbnailCockpitProps {
  thumbnailId: string;
  report: SaliencyReport;
  onOptimize?: () => void;
}

export function ThumbnailCockpit({
  thumbnailId,
  report,
  onOptimize,
}: ThumbnailCockpitProps) {
  const isHighCtr = report.predictedCtrPct >= 9.0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-semibold text-emerald-400">
            Dự đoán Thị giác Thumbnail & CTR (Gaze Predictor)
          </h3>
          <p className="text-xs text-slate-400">
            ID: {thumbnailId} &bull; Xếp hạng: <span className="font-semibold text-slate-200">{report.gazeFixationGrade}</span>
          </p>
        </div>
        <span
          className={`px-2.5 py-1 text-xs rounded-full font-mono border ${
            isHighCtr
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
              : 'bg-amber-950/60 text-amber-300 border-amber-800/80'
          }`}
        >
          Dự đoán CTR: {report.predictedCtrPct.toFixed(1)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
          <p className="text-slate-400">Điểm Thị giác (Saliency):</p>
          <p className="text-xl font-bold text-emerald-300 font-mono mt-1">
            {(report.saliencyScore * 100).toFixed(0)}/100
          </p>
        </div>
        <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
          <p className="text-slate-400">Đánh giá Thị giác:</p>
          <p className="text-lg font-bold text-slate-200 font-mono mt-1">
            {report.gazeFixationGrade}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-300">Khuyến nghị tối ưu (Recommendations):</p>
        <ul className="text-xs text-slate-400 list-disc list-inside space-y-0.5">
          {report.recommendations.map((rec, idx) => (
            <li key={idx}>{rec}</li>
          ))}
        </ul>
      </div>

      <button
        onClick={onOptimize}
        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition"
      >
        Tự động tinh chỉnh Thumbnail (Auto-Enhance)
      </button>
    </div>
  );
}
