/**
 * @file sound-pairing-selector.tsx
 * @description Catalog browser and beat-matched ducking selector for viral audio
 * @layer presentation
 */

'use client';

import React from 'react';
import type { ViralSoundTrack } from '@/seed/types/viral-expansion-types';

interface SoundPairingSelectorProps {
  sounds: ViralSoundTrack[];
  selectedSoundId: string | null;
  duckingDb: number;
  onSelectSound: (id: string) => void;
  onChangeDuckingDb: (db: number) => void;
  onTriggerPairing: () => void;
  isPairing: boolean;
}

export function SoundPairingSelector({
  sounds,
  selectedSoundId,
  duckingDb,
  onSelectSound,
  onChangeDuckingDb,
  onTriggerPairing,
  isPairing,
}: SoundPairingSelectorProps) {
  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
          🎵 Viral Sound Catalog & Dynamic Ducking
        </h3>
        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono">
          -14dB Standard
        </span>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {sounds.length === 0 ? (
          <div className="text-xs text-zinc-500 py-4 text-center">
            No sound tracks available in catalog.
          </div>
        ) : (
          sounds.map((track) => (
            <div
              key={track.id}
              onClick={() => onSelectSound(track.id)}
              className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                selectedSoundId === track.id
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="font-semibold text-zinc-200">{track.title}</div>
                <div className="text-zinc-500 text-[11px]">
                  {track.artist} • {track.bpm} BPM • Virality: {track.viralityIndex}/100
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {track.copyrightTier}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-4">
        <div className="flex-1">
          <label className="text-xs text-zinc-400 block mb-1">
            Voiceover Ducking: {duckingDb} dB
          </label>
          <input
            type="range"
            min="-24"
            max="-6"
            step="1"
            value={duckingDb}
            onChange={(e) => onChangeDuckingDb(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>
        <button
          onClick={onTriggerPairing}
          disabled={!selectedSoundId || isPairing}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          {isPairing ? 'Pairing...' : 'Apply MAB Pairing'}
        </button>
      </div>
    </div>
  );
}
