// src/components/growth-triad-v8/audio-resonance-cockpit.tsx

'use client';

import React from 'react';
import type { AudioResonanceOutput } from '@/seed/types/growth-triad-v8-types';

export function AudioResonanceCockpit({ data }: { data: AudioResonanceOutput }) {
  // Use Tailwind Rose theme as specified in wireframe
  return (
    <div className="rounded-xl border border-rose-500/20 bg-black/60 backdrop-blur tracking-tight shadow-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-rose-500">Audio Trend Pulse</h2>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
          BEAT_SYNC
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-black/40 border border-white/5">
          <div className="text-sm text-gray-500 mb-1">Resonance Score</div>
          <div className="text-3xl font-light text-white">{data.resonanceScore.toFixed(1)}</div>
          <div className="text-xs text-rose-400 mt-1">/ 100 Harmonic Index</div>
        </div>
        <div className="p-4 rounded-lg bg-black/40 border border-white/5">
          <div className="text-sm text-gray-500 mb-1">Sync Quality</div>
          <div className="text-3xl font-light text-white">{data.syncQuality}</div>
          <div className="text-xs text-rose-400 mt-1">Tolerance &le; 150ms</div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Ducking Markers</h3>
        {data.duckingMarkers.slice(0, 3).map((marker, idx) => (
          <div key={idx} className="flex justify-between items-center p-3 rounded bg-white/5 border border-white/5">
            <div className="font-mono text-sm text-white">
              {marker.startSec.toFixed(2)}s - {marker.endSec.toFixed(2)}s
            </div>
            <div className="text-sm text-rose-400 font-medium">
              {marker.targetDuckingDb.toFixed(1)}dB
            </div>
          </div>
        ))}
        {data.duckingMarkers.length > 3 && (
          <div className="text-xs text-center text-gray-500 mt-2">
            + {data.duckingMarkers.length - 3} additional markers
          </div>
        )}
      </div>
    </div>
  );
}
