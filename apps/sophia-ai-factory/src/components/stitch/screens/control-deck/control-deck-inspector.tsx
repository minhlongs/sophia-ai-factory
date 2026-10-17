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
    <section className="mt-5 rounded-xl border border-primary/50 bg-[#1A1C28] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs text-[#F59E0B]">
            {lang === 'vi' ? 'MÀN HÌNH' : 'SCREEN'} 0{activeScreen.index} · STITCH ID {activeScreen.stitchScreenId}
          </span>
          <h2 className="mt-1 font-sans text-xl font-bold text-[#F8FAFC]">
            {activeScreen.title[lang]}
          </h2>
          <p className="mt-1 text-sm text-[#94A3B8]">
            {activeScreen.subtitle[lang]}
          </p>
        </div>
        <div className="rounded-lg border border-[#1E2235] bg-[#090A10] px-4 py-2.5 text-right">
          <div className="text-xs text-[#94A3B8]">
            {activeScreen.primaryKpiLabel[lang]}
          </div>
          <div className="font-mono text-lg font-bold text-[#10B981]">
            {activeScreen.primaryKpiValue}
          </div>
        </div>
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {activeScreen.highlights.map((item) => (
          <li
            key={item.en}
            className="rounded-md border border-[#1E2235] bg-[#11131F] px-3 py-2 text-xs text-[#E3E1EB]"
          >
            • {item[lang]}
          </li>
        ))}
      </ul>
    </section>
  );
}
