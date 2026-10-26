'use client';

import React, { useState } from 'react';
import type {
  ControlDeckDataset,
  ControlDeckScreenId,
} from '@/seed/types/stitch-control-deck';
import { ControlDeckDemoNotice } from './control-deck-demo-notice';
import { ControlDeckScreenNav } from './control-deck-screen-nav';
import { ExecutiveMabPanel } from './executive-mab-panel';
import { AdvisorTimelinePanel } from './advisor-timeline-panel';
import { RevenuePortalsPanel } from './revenue-portals-panel';
import { ControlDeckInspector } from './control-deck-inspector';
export { ControlDeckInspector, type ControlDeckInspectorProps } from './control-deck-inspector';

export interface ControlDeckHubProps {
  readonly dataset: ControlDeckDataset;
  readonly initialLang?: 'en' | 'vi';
  readonly initialScreenId?: ControlDeckScreenId;
}

export function ControlDeckHub({
  dataset,
  initialLang = 'en',
  initialScreenId = 'dashboard',
}: Readonly<ControlDeckHubProps>) {
  const [lang, setLang] = useState<'en' | 'vi'>(initialLang);
  const [activeId, setActiveId] = useState<ControlDeckScreenId>(initialScreenId);

  const activeScreen =
    dataset.screens.find((item) => item.id === activeId) ?? dataset.screens[0];

  return (
    <main
      aria-label={dataset.directionName[lang]}
      className="min-h-screen w-full overflow-x-hidden bg-[#0B0E14] px-4 py-6 text-[#F8FAFC] md:px-8"
    >
      <div className="mx-auto max-w-7xl min-w-0">
        <ControlDeckDemoNotice lang={lang} />
        {/* Top Executive Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#1E2638] bg-[#121722] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_12px_32px_-8px_rgba(0,0,0,0.6)]">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-indigo-300">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" aria-hidden="true" />
                {lang === 'vi' ? 'ĐỒNG BỘ TRỰC TUYẾN' : 'LIVE TELEMETRY'}
              </span>
              <span className="truncate">STITCH PROJECT {dataset.projectId}</span>
              <span aria-hidden="true">·</span>
              <span>{lang === 'vi' ? `${dataset.screens.length} MÀN HÌNH STITCH V4.2` : `${dataset.screens.length} STITCH V4.2 SCREENS`}</span>
            </div>
            <h1 className="mt-2 break-words font-sans text-2xl font-bold tracking-tight text-[#F8FAFC] md:text-3xl">
              {dataset.directionName[lang]}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'en' ? 'vi' : 'en'))}
              aria-label={
                lang === 'vi'
                  ? 'Chuyển sang tiếng Anh (Switch to English)'
                  : 'Switch to Vietnamese (Chuyển sang tiếng Việt)'
              }
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-amber-400/60 bg-[#1A2130] px-4 py-2 font-mono text-xs font-semibold text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-colors motion-reduce:transition-none hover:border-amber-400 hover:bg-amber-400 hover:text-[#0B0E14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
              <span>{lang === 'vi' ? 'VI · TIẾNG VIỆT' : 'EN · ENGLISH'}</span>
            </button>
          </div>
        </header>

        <ControlDeckScreenNav
          screens={dataset.screens}
          activeId={activeScreen.id}
          lang={lang}
          onSelect={setActiveId}
        />

        <div
          id="stitch-panel"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`stitch-tab-${activeScreen.id}`}
          className="min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <ControlDeckInspector activeScreen={activeScreen} lang={lang} />
          <div className="mt-6 min-w-0 space-y-6">
            <ExecutiveMabPanel screen={activeScreen} mabArms={dataset.mabArms} lang={lang} />
            <AdvisorTimelinePanel advisors={dataset.advisors} timelineTracks={dataset.timelineTracks} lang={lang} />
            <RevenuePortalsPanel settlements={dataset.settlements} tokenSwatches={dataset.tokenSwatches} lang={lang} />
          </div>
        </div>
      </div>
    </main>
  );
}
