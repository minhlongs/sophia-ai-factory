'use client';

import React from 'react';
import type { StitchScreenSpec } from '@/seed/types/stitch-control-deck';

export interface ExecutiveMabHeaderProps {
  readonly screen: StitchScreenSpec;
  readonly lang: 'en' | 'vi';
}

export function ExecutiveMabHeader({
  screen,
  lang,
}: Readonly<ExecutiveMabHeaderProps>) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1E2638] pb-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-0.5 font-mono text-xs text-indigo-300">
            {screen.statusBadge[lang]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            {lang === 'vi' ? 'TRẦN HALF-KELLY f* ≤ 25%' : 'HALF-KELLY CAP f* ≤ 25%'}
          </span>
        </div>
        <h2
          id="mab-panel-heading"
          className="mt-2 break-words font-sans text-xl font-semibold tracking-tight text-[#F8FAFC]"
        >
          {screen.title[lang]}
        </h2>
        <p className="mt-1 break-words text-sm text-[#94A3B8]">{screen.subtitle[lang]}</p>
      </div>

      <div className="shrink-0 rounded-lg border border-amber-400/40 bg-[#0B0E14] px-4 py-3 text-right shadow-[inset_0_1px_0_0_rgba(245,158,11,0.18)]">
        <div className="text-xs font-medium text-[#94A3B8]">
          {screen.primaryKpiLabel[lang]}
        </div>
        <div className="font-mono text-2xl font-bold tabular-nums text-amber-400">
          {screen.primaryKpiValue}
        </div>
        <div className="font-mono text-[11px] text-emerald-400">
          {lang === 'vi'
            ? 'Half-Kelly f* = 18.4% · Ngắt lỗ -15%'
            : 'Demo values · Half-Kelly f* = 18.4% · -15% Circuit Breaker'}
        </div>
      </div>
    </header>
  );
}
