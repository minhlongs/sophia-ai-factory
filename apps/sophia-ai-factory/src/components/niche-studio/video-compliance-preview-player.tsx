/**
 * Video Compliance Preview Player Component
 *
 * Simulates 9:16 vertical smartphone viewport with ElevenLabs audio indicator,
 * dynamic compliance disclaimer overlay, and dispatch telemetry.
 * @module components/niche-studio/video-compliance-preview-player
 */

// i18n-namespace: nicheStudio
'use client';

import React, { useState } from 'react';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';

interface VideoCompliancePreviewPlayerProps {
  plan: NicheVideoCampaignPlan | null;
  dispatchedPlanId: string | null;
  t: (key: string) => string;
}

export function VideoCompliancePreviewPlayer({
  plan,
  dispatchedPlanId,
  t,
}: VideoCompliancePreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/40 rounded-xl border border-dashed border-zinc-800 text-center min-h-[460px]">
        <span className="text-3xl mb-3">📱</span>
        <h3 className="text-sm font-semibold text-zinc-300">{t('playerEmptyTitle')}</h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-[260px]">
          {t('playerEmptyDesc')}
        </p>
      </div>
    );
  }

  const isCrypto = Boolean(plan.overlaySpec);
  const disclaimer = isCrypto
    ? plan.overlaySpec?.bottomThirdBanner.text
    : 'Disclosure: Partner Link. We may earn a commission if you purchase.';

  return (
    <div className="space-y-4">
      {/* 9:16 Phone Mockup Container */}
      <div className="relative mx-auto w-full max-w-[280px] aspect-[9/16] rounded-2xl bg-zinc-950 border-4 border-zinc-800 shadow-2xl overflow-hidden flex flex-col justify-between p-3 select-none">
        {/* Top Info Bar */}
        <div className="flex items-center justify-between z-10 text-[10px]">
          <span className="px-1.5 py-0.5 rounded bg-black/60 text-zinc-300 font-mono">
            🎙️ ElevenLabs AI
          </span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            9:16 HD
          </span>
        </div>

        {/* Center Simulated Visuals & Play Toggle */}
        <div className="my-auto text-center space-y-2 z-10">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xl cursor-pointer hover:scale-105 transition-transform"
               onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </div>
          <p className="text-[11px] font-bold text-white px-2 leading-tight">
            {plan.productName}
          </p>
          <span className="text-[9px] text-zinc-400 font-mono block">
            {plan.blueprint.targetAudience}
          </span>
        </div>

        {/* Bottom Overlay Layer: Disclaimer & CTA */}
        <div className="space-y-2 z-10">
          {/* Coupon / CTA Pill */}
          <div className="bg-amber-500 text-zinc-950 text-center py-1.5 px-2 rounded-lg font-bold text-[11px] shadow-lg">
            👉 {plan.blueprint.id.includes('crypto') ? 'Claim Fee Rebate' : 'Get Special Access'}
          </div>

          {/* Compliance Disclaimer (WCAG AAA contrast on dark) */}
          <div className="bg-black/85 p-2 rounded border border-white/10 text-[9px] text-zinc-300 leading-tight text-center font-sans">
            ⚠️ <span className="font-semibold text-white/90">{disclaimer}</span>
          </div>
        </div>

        {/* Simulated subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 via-zinc-950 to-zinc-900/90 pointer-events-none" />
      </div>

      {/* Inngest Dispatch Telemetry */}
      {dispatchedPlanId && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 space-y-1">
          <div className="flex items-center justify-between font-semibold">
            <span>⚡ {t('dispatchedTitle')}</span>
            <span className="font-mono text-[10px]">Inngest Active</span>
          </div>
          <p className="text-[11px] text-zinc-400 font-mono truncate">
            Plan ID: {dispatchedPlanId}
          </p>
        </div>
      )}
    </div>
  );
}
