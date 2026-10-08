/**
 * @file multilingual-dub-matrix.tsx
 * @description Locale selector, pacing budget display, and lineage records ledger
 * @layer presentation
 */

'use client';

import React from 'react';
import type { SupportedDubLocale, LocalizedLineageRecord } from '@/seed/types/viral-expansion-types';

interface MultilingualDubMatrixProps {
  selectedLocales: SupportedDubLocale[];
  onToggleLocale: (loc: SupportedDubLocale) => void;
  lineages: LocalizedLineageRecord[];
  onTriggerDubbing: () => void;
  isDubbing: boolean;
}

const LOCALES_CONFIG: Array<{ id: SupportedDubLocale; name: string; flag: string; network: string; disclosure: string }> = [
  { id: 'en', name: 'English', flag: '🇺🇸', network: 'Amazon / ClickBank', disclosure: '#ad #affiliate' },
  { id: 'vi', name: 'Vietnamese', flag: '🇻🇳', network: 'Shopee / Accesstrade VN', disclosure: '#quangcao' },
  { id: 'es', name: 'Spanish', flag: '🇪🇸', network: 'Hotmart LATAM', disclosure: '#publicidad' },
  { id: 'id', name: 'Indonesian', flag: '🇮🇩', network: 'TikTok Shop ID', disclosure: '#iklan' },
  { id: 'ja', name: 'Japanese', flag: '🇯🇵', network: 'A8.net / Rakuten', disclosure: '#PR #タイアップ' },
];

export function MultilingualDubMatrix({
  selectedLocales,
  onToggleLocale,
  lineages,
  onTriggerDubbing,
  isDubbing,
}: MultilingualDubMatrixProps) {
  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
          🌍 Cross-Border Dubbing & Regional Affiliate Matrix
        </h3>
        <button
          onClick={onTriggerDubbing}
          disabled={selectedLocales.length === 0 || isDubbing}
          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          {isDubbing ? 'Synthesizing...' : `Dispatch Dubbing (${selectedLocales.length})`}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {LOCALES_CONFIG.map((loc) => {
          const isSelected = selectedLocales.includes(loc.id);
          return (
            <div
              key={loc.id}
              onClick={() => onToggleLocale(loc.id)}
              className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                isSelected
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span>{loc.flag}</span>
                <span className="font-bold text-zinc-200">{loc.name}</span>
              </div>
              <div className="text-[10px] text-zinc-400 truncate">{loc.network}</div>
              <div className="text-[9px] text-zinc-500 mt-1 font-mono">{loc.disclosure}</div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-zinc-800">
        <h4 className="text-xs font-semibold text-zinc-300 mb-2">Recent Localized Lineages</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {lineages.length === 0 ? (
            <div className="text-xs text-zinc-500 py-3 text-center">
              No localized lineages recorded yet.
            </div>
          ) : (
            lineages.map((record) => (
              <div
                key={record.id}
                className="p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-medium text-zinc-200 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 uppercase">
                      {record.locale}
                    </span>
                    <span>{record.translatedTitle}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {record.targetAffiliateNetwork} • Pacing: {record.pacingMultiplier}x • {record.audioDurationSeconds}s
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {record.lipSyncStatus}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
