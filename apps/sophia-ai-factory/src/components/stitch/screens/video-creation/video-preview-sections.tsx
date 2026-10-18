'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Play, ChevronDown } from 'lucide-react';
import { VOICE_OPTIONS } from './video-creation-types';

export function VideoPreviewMonitor() {
  const t = useTranslations('stitch.video-creation');

  return (
    <section className="mb-8">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {t('preview')}
      </h3>
      <div className="group relative cursor-pointer overflow-hidden rounded-xl border border-border dark:border-white/[0.08] bg-slate-950 studio-glass film-strip">
        <div className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-400 backdrop-blur-sm">
          <span
            className="camera-rec inline-block h-2 w-2 rounded-full bg-rose-500"
            aria-hidden="true"
          />
          <span>REC</span>
        </div>
        <div className="aspect-video w-full overflow-hidden">
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <Play className="h-12 w-12" aria-hidden="true" />
          </div>
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        >
          <Play className="h-12 w-12 text-white" aria-hidden="true" />
        </div>
        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm">
          {t('previewDuration')}
        </div>
      </div>
    </section>
  );
}

interface VoicePreviewSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
}

export function VoicePreviewSelector({
  selectedVoice,
  onVoiceChange,
}: VoicePreviewSelectorProps) {
  const t = useTranslations('stitch.video-creation');

  return (
    <section className="mb-8">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {t('voicePreview')}
      </h3>
      <div className="relative">
        <select
          value={selectedVoice}
          onChange={(e) => onVoiceChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-border dark:border-white/[0.08] bg-background dark:bg-[#090A10] px-4 py-2.5 pr-10 text-sm text-foreground dark:text-white outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
          aria-label={t('voicePreview')}
        >
          {VOICE_OPTIONS.map((voice) => (
            <option key={voice} value={voice}>
              {t(`voices.${voice}`)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={18}
          aria-hidden="true"
        />
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-border dark:border-white/[0.08] bg-background dark:bg-[#090A10] p-2.5">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-label={t('playVoicePreview')}
        >
          <Play className="h-4 w-4" aria-hidden="true" />
        </button>
        <div
          className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted dark:bg-white/[0.08]"
          role="progressbar"
          aria-valuenow={33}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('voiceProgress')}
        >
          <div
            className="absolute inset-0 bg-primary/70"
            style={{
              width: '33%',
            }}
          />
        </div>
      </div>
    </section>
  );
}
