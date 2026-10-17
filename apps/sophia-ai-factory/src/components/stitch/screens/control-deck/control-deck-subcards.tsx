'use client';

import React from 'react';
import type {
  MabArmTelemetry,
  VideoTimelineTrack,
} from '@/seed/types/stitch-control-deck';

export function MabArmCard({
  arm,
  lang,
}: Readonly<{ arm: MabArmTelemetry; lang: 'en' | 'vi' }>) {
  return (
    <article
      aria-label={arm.hookName[lang]}
      className={`rounded-lg border p-4 transition-colors duration-150 motion-reduce:transition-none ${
        arm.isChampion
          ? 'border-primary bg-[#1A1C28] shadow-[0_0_16px_hsl(var(--primary)/0.2)]'
          : 'border-[#1E2235] bg-[#090A10]/80'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-[#94A3B8]">{arm.armId}</span>
        {arm.isChampion ? (
          <span className="rounded-full border border-[#10B981]/40 bg-[#10B981]/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#10B981]">
            {lang === 'vi' ? 'NHÁNH DẪN ĐẦU' : 'CHAMPION ARM'}
          </span>
        ) : (
          <span className="rounded-full border border-[#1E2235] bg-[#11131F] px-2.5 py-0.5 font-mono text-[11px] text-[#94A3B8]">
            {lang === 'vi' ? 'ĐANG THỬ NGHIỆM' : 'EXPLORING'}
          </span>
        )}
      </div>

      <h3 className="mt-2 font-sans text-sm font-semibold text-[#F8FAFC]">
        {arm.hookName[lang]}
      </h3>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[#1E2235] pt-3 font-mono text-xs">
        <div>
          <dt className="text-[11px] text-[#94A3B8]">Beta(α,β)</dt>
          <dd className="mt-0.5 font-semibold text-[#F8FAFC]">
            ({arm.alpha},{arm.beta})
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-[#94A3B8]">
            {lang === 'vi' ? 'Xác Suất Thắng' : 'Win Prob'}
          </dt>
          <dd className="mt-0.5 font-semibold text-[#10B981]">
            {arm.winProbabilityPct}%
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-[#94A3B8]">Half-Kelly</dt>
          <dd className="mt-0.5 font-semibold text-[#F59E0B]">
            {arm.halfKellyAllocationPct}% ({arm.roasMultiplier})
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function VideoTimelineSection({
  timelineTracks,
  lang,
}: Readonly<{
  timelineTracks: readonly VideoTimelineTrack[];
  lang: 'en' | 'vi';
}>) {
  return (
    <section
      aria-labelledby="timeline-heading"
      className="rounded-xl border border-[#1E2235] bg-[#11131F] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
    >
      <header className="flex items-center justify-between border-b border-[#1E2235] pb-3">
        <div>
          <span className="font-mono text-xs text-primary">
            {lang === 'vi'
              ? 'MÀN HÌNH 03 · MÃ THỜI GIAN 00:01:24:18'
              : 'SCREEN 03 · TIMECODE 00:01:24:18'}
          </span>
          <h2 id="timeline-heading" className="mt-1 font-sans text-lg font-semibold text-[#F8FAFC]">
            {lang === 'vi' ? 'Timeline Đa Làn & Xưởng Kết Xuất Video AI' : 'Multi-Track NLE Timeline & AI Render Stage'}
          </h2>
        </div>
        <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 font-mono text-xs text-[#C0C1FF]">
          16:9 + 9:16 SYNC
        </span>
      </header>

      <div
        className="mt-4 space-y-3"
        role="list"
        aria-label={lang === 'vi' ? 'Các làn timeline video' : 'Video timeline tracks'}
      >
        {timelineTracks.map((track) => (
          <div key={track.trackId} role="listitem" className="rounded-lg border border-[#1E2235] bg-[#090A10] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-6 w-9 items-center justify-center rounded bg-[#1A1C28] font-mono text-xs font-bold text-[#C0C1FF]">
                  {track.trackCode}
                </span>
                <span className="font-sans text-sm font-medium text-[#F8FAFC]">{track.label[lang]}</span>
              </div>
              <span className="font-mono text-xs text-[#94A3B8]">
                {track.modelBadge} · {track.durationTimecode}
              </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#1A1C28]">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 motion-reduce:transition-none"
                style={{ width: `${track.progressPct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
