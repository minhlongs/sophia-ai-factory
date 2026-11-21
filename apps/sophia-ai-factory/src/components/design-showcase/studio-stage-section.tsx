'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Film, Lock, Sparkles } from 'lucide-react';
import { Badge } from '@/seed/components/ui/badge';

const STUDIO_STAGE_VARS = [
  '--studio-stage-bg',
  '--studio-stage-panel',
  '--studio-stage-fg',
  '--studio-stage-border',
] as const;

export function StudioStageSection() {
  const t = useTranslations('designShowcase');

  return (
    <section
      id="studio-stage"
      aria-labelledby="design-studio-stage-heading"
      className="scroll-mt-24 space-y-6"
    >
      <div className="space-y-1.5">
        <Badge variant="enterprise">{t('studioStage.eyebrow')}</Badge>
        <h2
          id="design-studio-stage-heading"
          className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
        >
          {t('studioStage.title')}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t('studioStage.description')}
        </p>
      </div>

      {/* Dedicated Studio Dark Stage Invariant Surface */}
      <div
        data-testid="studio-stage-invariant"
        className="overflow-hidden rounded-2xl border p-6 shadow-lg"
        style={{
          backgroundColor: 'var(--studio-stage-bg)',
          color: 'var(--studio-stage-fg)',
          borderColor: 'var(--studio-stage-border)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--studio-stage-border)' }}>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border"
              style={{
                backgroundColor: 'var(--studio-stage-panel)',
                borderColor: 'var(--studio-stage-border)',
              }}
            >
              <Film className="h-4 w-4 text-indigo-400" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">{t('studioStage.previewTitle')}</p>
              <p className="font-mono text-xs opacity-75">{t('studioStage.previewSubtitle')}</p>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs"
            style={{
              backgroundColor: 'var(--studio-stage-panel)',
              borderColor: 'var(--studio-stage-border)',
            }}
          >
            <Lock className="h-3 w-3 text-amber-400" aria-hidden="true" />
            {t('studioStage.lockedBadge')}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div
            className="rounded-xl border p-4 lg:col-span-2"
            style={{
              backgroundColor: 'var(--studio-stage-panel)',
              borderColor: 'var(--studio-stage-border)',
            }}
          >
            <div className="flex items-center justify-between text-xs opacity-75">
              <span className="font-mono">TIMELINE · 00:00:12:08</span>
              <span className="inline-flex items-center gap-1 font-mono text-emerald-400">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                HDR · 4K 60fps
              </span>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-7 rounded-md bg-indigo-500/25 px-3 py-1.5 font-mono text-[11px]">
                V1 · Scene_01_Director_Cut.mp4
              </div>
              <div className="h-7 w-4/5 rounded-md bg-violet-500/25 px-3 py-1.5 font-mono text-[11px]">
                A1 · Voiceover_VI_Master.wav
              </div>
              <div className="h-7 w-2/3 rounded-md bg-amber-500/25 px-3 py-1.5 font-mono text-[11px]">
                FX · Subtitle_Kinetic_Overlay
              </div>
            </div>
          </div>

          <div
            className="space-y-2.5 rounded-xl border p-4"
            style={{
              backgroundColor: 'var(--studio-stage-panel)',
              borderColor: 'var(--studio-stage-border)',
            }}
          >
            <p className="font-mono text-xs font-semibold uppercase tracking-wider opacity-75">
              {t('studioStage.tokensHeading')}
            </p>
            <ul className="space-y-2">
              {STUDIO_STAGE_VARS.map((cssVar) => (
                <li
                  key={cssVar}
                  className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-xs"
                  style={{ borderColor: 'var(--studio-stage-border)' }}
                >
                  <span>{cssVar}</span>
                  <span
                    className="h-4 w-4 rounded border"
                    style={{
                      backgroundColor: `var(${cssVar})`,
                      borderColor: 'var(--studio-stage-border)',
                    }}
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
