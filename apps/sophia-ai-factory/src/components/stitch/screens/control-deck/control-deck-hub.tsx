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
}

export function ControlDeckHub({
  dataset,
  initialLang = 'en',
}: Readonly<ControlDeckHubProps>) {
  const [lang, setLang] = useState<'en' | 'vi'>(initialLang);
  const [activeId, setActiveId] = useState<ControlDeckScreenId>('dashboard');

  const activeScreen =
    dataset.screens.find((item) => item.id === activeId) ?? dataset.screens[0];

  return (
    <main
      aria-label={dataset.directionName[lang]}
      className="min-h-screen bg-[#090A10] px-4 py-6 text-[#F8FAFC] md:px-8"
    >
      <ControlDeckDemoNotice lang={lang} />
      {/* Top Executive Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#1E2235] bg-[#11131F] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-[#C0C1FF]">
            <span>STITCH PROJECT {dataset.projectId}</span>
            <span>·</span>
            <span>{lang === 'vi' ? '9 Ý TƯỞNG GIAO DIỆN' : '9 DESIGN CONCEPTS'}</span>
          </div>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-[#F8FAFC] md:text-3xl">
            {dataset.directionName[lang]}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang((prev) => (prev === 'en' ? 'vi' : 'en'))}
            aria-label={
              lang === 'vi'
                ? 'Chuyển sang tiếng Anh (Switch to English)'
                : 'Switch to Vietnamese (Chuyển sang tiếng Việt)'
            }
            className="rounded-lg border border-primary bg-[#1A1C28] px-3.5 py-2 font-mono text-xs font-semibold text-[#F8FAFC] transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {lang === 'vi' ? 'VI · TIẾNG VIỆT' : 'EN · ENGLISH'}
          </button>
        </div>
      </header>

      <ControlDeckScreenNav
        screens={dataset.screens}
        activeId={activeScreen.id}
        lang={lang}
        onSelect={setActiveId}
      />

      <div id="stitch-panel" role="tabpanel" tabIndex={0} aria-labelledby={`stitch-tab-${activeScreen.id}`}>
        <ControlDeckInspector activeScreen={activeScreen} lang={lang} />
        <div className="mt-6 space-y-6">
          <ExecutiveMabPanel screen={activeScreen} mabArms={dataset.mabArms} lang={lang} />
          <AdvisorTimelinePanel advisors={dataset.advisors} timelineTracks={dataset.timelineTracks} lang={lang} />
          <RevenuePortalsPanel settlements={dataset.settlements} tokenSwatches={dataset.tokenSwatches} lang={lang} />
        </div>
      </div>
    </main>
  );
}
