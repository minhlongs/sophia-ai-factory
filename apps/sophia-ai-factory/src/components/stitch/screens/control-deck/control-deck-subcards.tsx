'use client';

import React from 'react';
import type {
  MabArmTelemetry,
  VideoTimelineTrack,
} from '@/seed/types/stitch-control-deck';
import { StitchProgressMeter } from '@/components/stitch/ui/stitch-progress-meter';

export function MabArmCard({
  arm,
  lang,
}: Readonly<{ arm: MabArmTelemetry; lang: 'en' | 'vi' }>) {
  const allocWidth = Math.min(100, Math.max(8, arm.halfKellyAllocationPct));
  return (
    <article
      aria-label={arm.hookName[lang]}
      className={`min-w-0 rounded-xl border p-4 transition-colors duration-150 motion-reduce:transition-none ${
        arm.isChampion
          ? 'border-amber-400/60 bg-[#1A2130] shadow-[inset_0_1px_0_0_rgba(245,158,11,0.22),0_0_20px_rgba(245,158,11,0.12)]'
          : 'border-[#1E2638] bg-[#0B0E14]/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-[#94A3B8]">{arm.armId}</span>
        {arm.isChampion ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            {lang === 'vi' ? 'NHÁNH DẪN ĐẦU' : 'CHAMPION ARM'}
          </span>
        ) : (
          <span className="rounded-full border border-[#1E2638] bg-[#121722] px-2.5 py-0.5 font-mono text-[11px] text-[#94A3B8]">
            {lang === 'vi' ? 'ĐANG THỬ NGHIỆM' : 'EXPLORING'}
          </span>
        )}
      </div>

      <h3 className="mt-2 break-words font-sans text-sm font-semibold text-[#F8FAFC]">
        {arm.hookName[lang]}
      </h3>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between font-mono text-[11px] text-[#94A3B8]">
          <span>{lang === 'vi' ? 'Tỷ trọng Half-Kelly' : 'Half-Kelly Share'}</span>
          <span className="font-semibold tabular-nums text-amber-400">{arm.halfKellyAllocationPct}%</span>
        </div>
        <StitchProgressMeter valuePct={allocWidth} tone={arm.isChampion ? 'amber' : 'indigo'} heightClass="h-2" />
      </div>

      <dl className="mt-3.5 grid grid-cols-3 gap-2 border-t border-[#1E2638] pt-3 font-mono text-xs">
        <div className="min-w-0">
          <dt className="text-[11px] text-[#94A3B8]">Beta(α,β)</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[#F8FAFC]">({arm.alpha},{arm.beta})</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-[#94A3B8]">{lang === 'vi' ? 'Xác Suất Thắng' : 'Win Prob'}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-emerald-400">{arm.winProbabilityPct}%</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-[#94A3B8]">Half-Kelly</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-amber-400">
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
      className="min-w-0 rounded-xl border border-[#1E2638] bg-[#121722] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2638] pb-3">
        <div className="min-w-0">
          <span className="font-mono text-xs text-indigo-400">
            {lang === 'vi' ? 'MÀN HÌNH 03 · MÃ THỜI GIAN 00:01:24:18' : 'SCREEN 03 · TIMECODE 00:01:24:18'}
          </span>
          <h2 id="timeline-heading" className="mt-1 break-words font-sans text-lg font-semibold text-[#F8FAFC]">
            {lang === 'vi' ? 'Timeline Đa Làn & Xưởng Kết Xuất Video AI' : 'Multi-Track NLE Timeline & AI Render Stage'}
          </h2>
        </div>
        <span className="rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1 font-mono text-xs font-semibold text-indigo-300">
          16:9 + 9:16 SYNC
        </span>
      </header>

      <div className="mt-4 space-y-3" role="list" aria-label={lang === 'vi' ? 'Các làn timeline video' : 'Video timeline tracks'}>
        {timelineTracks.map((track) => (
          <div key={track.trackId} role="listitem" className="min-w-0 rounded-lg border border-[#1E2638] bg-[#0B0E14] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-6 w-9 shrink-0 items-center justify-center rounded border border-indigo-400/30 bg-[#1A2130] font-mono text-xs font-bold text-indigo-300">
                  {track.trackCode}
                </span>
                <span className="min-w-0 break-words font-sans text-sm font-medium text-[#F8FAFC]">{track.label[lang]}</span>
              </div>
              <span className="font-mono text-xs tabular-nums text-amber-400">
                {track.modelBadge} · {track.durationTimecode} · {track.progressPct}%
              </span>
            </div>
            <StitchProgressMeter valuePct={track.progressPct} tone="indigo" heightClass="h-2.5" className="mt-2.5" />
          </div>
        ))}
      </div>
    </section>
  );
}
