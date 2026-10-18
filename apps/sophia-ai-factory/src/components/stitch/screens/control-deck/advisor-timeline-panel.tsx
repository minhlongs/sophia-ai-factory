'use client';

import React, { useState } from 'react';
import type {
  AdvisorNodeTelemetry,
  BilingualText,
  VideoTimelineTrack,
} from '@/seed/types/stitch-control-deck';
import { dispatchAdvisorCouncilMissionAction } from '@/land/control-deck';
import { VideoTimelineSection } from './control-deck-subcards';

export interface AdvisorTimelinePanelProps {
  readonly advisors: readonly AdvisorNodeTelemetry[];
  readonly timelineTracks: readonly VideoTimelineTrack[];
  readonly lang: 'en' | 'vi';
}

export function AdvisorTimelinePanel({
  advisors,
  timelineTracks,
  lang,
}: Readonly<AdvisorTimelinePanelProps>) {
  const [dispatchStatus, setDispatchStatus] = useState<BilingualText | null>(
    null,
  );
  const [isDispatching, setIsDispatching] = useState(false);

  const handleDispatchCouncil = async () => {
    setIsDispatching(true);
    try {
      const res = await dispatchAdvisorCouncilMissionAction({
        screenId: 'ask-advisors',
        mcuBudget: 1000,
      });
      setDispatchStatus(res.message);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Screen 2: Bilingual /ask 4-Advisor Consultation Deck */}
      <section
        aria-labelledby="advisors-heading"
        className="min-w-0 rounded-xl border border-[#1E2638] bg-[#121722] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2638] pb-3.5">
          <div className="min-w-0 flex-1">
            <span className="font-mono text-xs text-indigo-400">
              {lang === 'vi'
                ? 'MÀN HÌNH 02 · HỘI ĐỒNG 4 CỐ VẤN'
                : 'SCREEN 02 · /ASK 4-ADVISOR COUNCIL'}
            </span>
            <h2
              id="advisors-heading"
              className="mt-1 break-words font-sans text-lg font-semibold text-[#F8FAFC]"
            >
              {lang === 'vi'
                ? 'Hội Đồng Tham Vấn 4 Cố Vấn Chiến Lược'
                : '4-Advisor Parallel Strategic Synthesis'}
            </h2>
          </div>
          <button
            type="button"
            disabled={isDispatching}
            onClick={handleDispatchCouncil}
            data-testid="dispatch-advisor-council-btn"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-amber-400/70 bg-indigo-600 px-4 py-2 font-mono text-xs font-semibold text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] transition-colors motion-reduce:transition-none hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${isDispatching ? 'animate-ping bg-amber-300 motion-reduce:animate-none' : 'bg-emerald-400'}`}
            />
            <span>
              {lang === 'vi'
                ? 'Phê Duyệt & Điều Phối 1 Chạm'
                : '1-Click Approve & Dispatch'}
            </span>
          </button>
        </header>

        {dispatchStatus && (
          <div
            role="status"
            data-testid="dispatch-advisor-council-receipt"
            className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-3.5 py-2.5 font-mono text-xs text-emerald-400"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">{dispatchStatus[lang]}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {advisors.map((adv) => (
            <article
              key={adv.advisorId}
              className="min-w-0 rounded-xl border border-[#1E2638] bg-[#0B0E14]/90 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="min-w-0 break-words font-sans text-sm font-semibold text-[#F8FAFC]">
                  {adv.personaTitle[lang]}
                </h3>
                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-amber-400">
                  {adv.confidenceScorePct}%
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-indigo-300">
                {adv.domainFocus[lang]}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1A2130]">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-300 motion-reduce:transition-none"
                  style={{ width: `${adv.confidenceScorePct}%` }}
                />
              </div>
              <p className="mt-2 break-words text-xs leading-relaxed text-[#94A3B8]">
                {adv.verdictSummary[lang]}
              </p>
            </article>
          ))}
        </div>
      </section>

      <VideoTimelineSection timelineTracks={timelineTracks} lang={lang} />
    </div>
  );
}
