/**
 * @file seo-surge-cockpit.tsx
 * @description Presentation component for Search-Surge SEO Jacker & Algorithm Optimization
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import type { SurgeDetectionResult, SeoMetadataOutput } from '@/seed/types/growth-triad-v6-types';

interface SeoSurgeCockpitProps {
  surges: SurgeDetectionResult[];
  onJackTrend?: (keyword: string) => void;
  metadata?: SeoMetadataOutput | null;
}

export function SeoSurgeCockpit({
  surges,
  onJackTrend,
  metadata,
}: SeoSurgeCockpitProps) {
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(
    surges[0]?.keyword ?? null
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>🚀</span> Search-Surge Trend Jacker
          </h3>
          <p className="text-xs text-slate-400">
            Phát hiện đột biến lưu lượng tìm kiếm (Z-score &ge; 2.5) & tự động tối ưu SEO
          </p>
        </div>
        <span className="text-xs bg-amber-950 border border-amber-600 text-amber-400 px-2 py-0.5 rounded-full font-mono">
          Z-Score Anomaly
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {surges.map((surge) => {
          const isSelected = selectedKeyword === surge.keyword;

          return (
            <div
              key={surge.keyword}
              onClick={() => setSelectedKeyword(surge.keyword)}
              className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                isSelected
                  ? 'bg-slate-950 border-amber-500/50 ring-1 ring-amber-500/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-slate-200">{surge.keyword}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  surge.isSurging ? 'bg-red-950 text-red-400 border border-red-700' : 'bg-slate-800 text-slate-400'
                }`}>
                  Z: {surge.zScore}
                </span>
              </div>

              <div className="space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Vận tốc tìm kiếm:</span>
                  <span className="text-emerald-400 font-mono">{surge.currentVelocity} /hr</span>
                </div>
                <div className="flex justify-between">
                  <span>Ý định tìm kiếm:</span>
                  <span className="text-indigo-400 font-semibold">{surge.intent}</span>
                </div>
              </div>

              {surge.isSurging && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onJackTrend?.(surge.keyword);
                  }}
                  className="mt-3 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1.5 rounded transition text-xs"
                >
                  Bắt trend ngay (Jack Trend)
                </button>
              )}
            </div>
          );
        })}
      </div>

      {metadata && (
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-2">
          <div className="font-semibold text-amber-400">Tiêu đề đề xuất:</div>
          <div className="text-slate-200">{metadata.title}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {metadata.tags.map((tag) => (
              <span key={tag} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
