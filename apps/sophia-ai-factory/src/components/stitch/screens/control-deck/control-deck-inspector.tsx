'use client';

import React from 'react';
import type { StitchScreenSpec } from '@/seed/types/stitch-control-deck';

export interface ControlDeckInspectorProps {
  readonly activeScreen: StitchScreenSpec;
  readonly lang: 'en' | 'vi';
}

export function ControlDeckInspector({
  activeScreen,
  lang,
}: Readonly<ControlDeckInspectorProps>) {
  return (
    <section className="mt-5 min-w-0 rounded-xl border border-amber-400/40 bg-[#121722] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_12px_28px_-8px_rgba(0,0,0,0.5)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
              {lang === 'vi' ? 'MÀN HÌNH' : 'SCREEN'} {String(activeScreen.index).padStart(2, '0')} · STITCH ID {activeScreen.stitchScreenId}
            </span>
            <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[11px] text-indigo-300">
              {activeScreen.statusBadge[lang]}
            </span>
          </div>
          <h2 className="mt-2 break-words font-sans text-xl font-bold tracking-tight text-[#F8FAFC]">
            {activeScreen.title[lang]}
          </h2>
          <p className="mt-1 break-words text-sm leading-relaxed text-[#94A3B8]">
            {activeScreen.subtitle[lang]}
          </p>
        </div>
        <div className="shrink-0 rounded-lg border border-emerald-400/35 bg-[#0B0E14] px-4 py-3 text-right shadow-[inset_0_1px_0_0_rgba(16,185,129,0.15)]">
          <div className="font-mono text-xs text-[#94A3B8]">
            {activeScreen.primaryKpiLabel[lang]}
          </div>
          <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-emerald-400">
            {activeScreen.primaryKpiValue}
          </div>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {activeScreen.highlights.map((item) => (
          <li
            key={item.en}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-[#1E2638] bg-[#0B0E14]/90 px-3.5 py-2.5 text-xs text-[#E3E1EB] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">• {item[lang]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
