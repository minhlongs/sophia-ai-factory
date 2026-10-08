/**
 * @file kinetic-subtitle-matrix.tsx
 * @description Preset switcher and preview frame matrix for kinetic subtitles
 * @layer presentation
 */

'use client';

import React from 'react';
import type { SubtitleAnimationPreset } from '@/seed/types/viral-expansion-types';

interface KineticSubtitleMatrixProps {
  selectedPreset: SubtitleAnimationPreset;
  onSelectPreset: (preset: SubtitleAnimationPreset) => void;
  enableEmoji: boolean;
  onToggleEmoji: (val: boolean) => void;
}

const PRESETS: Array<{ id: SubtitleAnimationPreset; label: string; desc: string; sample: string }> = [
  {
    id: 'HORMOZI_HIGHLIGHT',
    label: 'Hormozi Punch',
    desc: 'Uppercase bold with high-contrast yellow/red pop emphasis',
    sample: 'STOP WASTING 💸 MONEY',
  },
  {
    id: 'BEAST_POP',
    label: 'Beast Pop-Scale',
    desc: '110% elastic bouncy scale jumps on critical keywords',
    sample: 'WINNING 🏆 BLUEPRINT',
  },
  {
    id: 'MINIMAL_CYBER',
    label: 'Minimal Cyber',
    desc: 'Monospace cyan terminal glow for tech and SaaS topics',
    sample: '10X DEV PIPELINE ⚡',
  },
  {
    id: 'NEON_PULSE',
    label: 'Neon Pulse',
    desc: 'Fuchsia pulse glow for lifestyle and viral hooks',
    sample: 'SECRET 🤫 FORMULA',
  },
];

export function KineticSubtitleMatrix({
  selectedPreset,
  onSelectPreset,
  enableEmoji,
  onToggleEmoji,
}: KineticSubtitleMatrixProps) {
  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
          ✨ Kinetic Subtitle Presets
        </h3>
        <label className="text-xs text-zinc-400 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enableEmoji}
            onChange={(e) => onToggleEmoji(e.target.checked)}
            className="rounded accent-amber-500"
          />
          Auto-Emoji Inject
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PRESETS.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelectPreset(p.id)}
            className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all ${
              selectedPreset === p.id
                ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-zinc-200">{p.label}</span>
              {selectedPreset === p.id && (
                <span className="text-[10px] text-amber-400 font-mono">ACTIVE</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mb-2 leading-relaxed">{p.desc}</p>
            <div className="p-2 rounded bg-black/60 border border-zinc-800/80 text-center font-black tracking-wide text-zinc-100 text-xs">
              {p.sample}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
