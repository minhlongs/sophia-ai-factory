/**
 * @file attribution-cockpit.tsx
 * @description Presentation component for Omnichannel Multi-Touch Attribution & LTV/CAC
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import type {
  TouchpointRecord,
  AttributionModel,
} from '@/seed/types/growth-triad-v3-types';

interface AttributionCockpitProps {
  touchpoints: TouchpointRecord[];
  onCalculateAttribution?: (model: AttributionModel) => void;
}

export function AttributionCockpit({
  touchpoints,
  onCalculateAttribution,
}: AttributionCockpitProps) {
  const [selectedModel, setSelectedModel] =
    useState<AttributionModel>('TIME_DECAY');

  const ltvCac = touchpoints[0]?.ltvCacRatio ?? 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <span>📊</span> Omnichannel Multi-Touch Attribution
          </h3>
          <p className="text-xs text-slate-400">
            Mô hình First-Touch, Last-Touch & Time-Decay (Chu kỳ bán rã 7 ngày)
          </p>
        </div>
        <span className="text-xs bg-emerald-950 border border-emerald-600 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
          LTV/CAC: {ltvCac.toFixed(2)}x
        </span>
      </div>

      <div className="flex gap-2">
        {(['TIME_DECAY', 'FIRST_TOUCH', 'LAST_TOUCH'] as AttributionModel[]).map(
          (m) => (
            <button
              key={m}
              onClick={() => {
                setSelectedModel(m);
                onCalculateAttribution?.(m);
              }}
              className={`flex-1 text-[11px] py-1.5 rounded border transition font-medium ${
                selectedModel === m
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              {m.replace('_', ' ')}
            </button>
          )
        )}
      </div>

      <div className="space-y-3">
        {touchpoints.map((tp) => (
          <div
            key={tp.id}
            className="p-3 rounded-lg border text-xs bg-slate-950/60 border-slate-800"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-slate-200">
                {tp.channelSource}
              </span>
              <span className="text-amber-400 font-bold">
                {tp.weightPercentage}% Attribution
              </span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Attributed GMV: ${tp.attributedGmv.toLocaleString()}</span>
              <span className="text-emerald-400">{tp.payoutStatus}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
