/**
 * Generated viral hook variants list (tap to select)
 *
 * Layer: Forest (UI components & coordinators)
 *
 * @module forest/growth/viral-funnel/generated-hooks-list
 */

import React from 'react';
import type { ViralHook } from '@/seed/types/growth';

export interface GeneratedHooksListProps {
  isVi: boolean;
  hooks: ViralHook[];
  selectedHook: ViralHook | null;
  onSelect: (hook: ViralHook) => Promise<void>;
}

export function GeneratedHooksList({ isVi, hooks, selectedHook, onSelect }: GeneratedHooksListProps) {
  if (hooks.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
        {isVi ? 'Biến Thể Mở Đầu Đề Xuất (Bấm Để Chọn):' : 'Recommended Opening Hooks (Tap to Select):'}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {hooks.map((h) => (
          <button
            key={h.id}
            onClick={() => onSelect(h)}
            className={`text-left p-3.5 rounded-xl border transition-all ${
              selectedHook?.id === h.id
                ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500'
                : 'border-neutral-800 bg-neutral-800/40 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                {h.archetype.replace('_', ' ')}
              </span>
              <span className="text-[10px] font-bold text-emerald-400">
                {h.expectedRetentionScore}% {isVi ? 'Giữ Chân' : 'Retention'}
              </span>
            </div>
            <p className="text-xs text-white font-medium">{isVi ? h.hookTextVi : h.hookText}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
