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
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Screen 2: Bilingual /ask 4-Advisor Consultation Deck */}
      <section
        aria-labelledby="advisors-heading"
        className="rounded-xl border border-[#1E2235] bg-[#11131F] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
      >
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2235] pb-3">
          <div>
            <span className="font-mono text-xs text-[#A855F7]">
              {lang === 'vi'
                ? 'MÀN HÌNH 02 · HỘI ĐỒNG 4 CỐ VẤN'
                : 'SCREEN 02 · /ASK 4-ADVISOR COUNCIL'}
            </span>
            <h2
              id="advisors-heading"
              className="mt-1 font-sans text-lg font-semibold text-[#F8FAFC]"
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
            className="rounded-lg border border-primary bg-primary px-3 py-1.5 font-mono text-xs font-semibold text-[#F8FAFC] transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {lang === 'vi'
              ? 'Phê Duyệt & Điều Phối 1 Chạm'
              : '1-Click Approve & Dispatch'}
          </button>
        </header>

        {dispatchStatus && (
          <div
            role="status"
            data-testid="dispatch-advisor-council-receipt"
            className="mt-3 rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 px-3 py-2 font-mono text-xs text-[#10B981]"
          >
            {dispatchStatus[lang]}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {advisors.map((adv) => (
            <article
              key={adv.advisorId}
              className="rounded-lg border border-[#1E2235] bg-[#1A1C28]/90 p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-sans text-sm font-semibold text-[#F8FAFC]">
                  {adv.personaTitle[lang]}
                </h3>
                <span className="font-mono text-xs font-semibold text-[#F59E0B]">
                  {adv.confidenceScorePct}%
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-[#C0C1FF]">
                {adv.domainFocus[lang]}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
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
