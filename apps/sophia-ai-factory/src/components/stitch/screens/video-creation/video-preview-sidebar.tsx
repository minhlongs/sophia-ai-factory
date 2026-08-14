'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Play, ChevronDown, CheckCircle } from 'lucide-react';
import { VOICE_OPTIONS, VISUAL_STYLES } from './video-creation-types';

interface VideoPreviewSidebarProps {
  selectedVoice: string;
  selectedStyle: string;
  onVoiceChange: (voice: string) => void;
  onStyleChange: (style: string) => void;
}

/**
 * Right sidebar with video preview, voice selector, and visual style picker.
 */
export function VideoPreviewSidebar({
  selectedVoice,
  selectedStyle,
  onVoiceChange,
  onStyleChange,
}: VideoPreviewSidebarProps) {
  const t = useTranslations('stitch.video-creation');

  return (
    <aside
      className="hidden w-[320px] flex-shrink-0 overflow-y-auto border-l p-4 md:block lg:p-6 stitch-scrollbar"
      style={{
        backgroundColor: '#131318',
        borderColor: '#484750',
      }}
      aria-label={t('sidebarLabel')}
    >
      {/* Preview */}
      <section className="mb-8">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#acaab5]">
          {t('preview')}
        </h3>
        <div
          className="group relative cursor-pointer overflow-hidden rounded-xl border"
          style={{ borderColor: '#484750' }}
        >
          <div className="aspect-video w-full overflow-hidden">
            <div className="flex h-full w-full items-center justify-center text-[#acaab5]">
              <Play className="h-12 w-12" aria-hidden="true" />
            </div>
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          >
            <Play className="h-12 w-12 text-white" aria-hidden="true" />
          </div>
          <div
            className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm"
            style={{ fontFamily: 'monospace' }}
          >
            {t('previewDuration')}
          </div>
        </div>
      </section>

      {/* Voice Preview */}
      <section className="mb-8">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#acaab5]">
          {t('voicePreview')}
        </h3>
        <div className="relative">
          <select
            value={selectedVoice}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="w-full appearance-none rounded-lg border px-4 py-2.5 pr-10 text-sm text-[#e7e4f0] outline-none transition-all focus:ring-2 focus:ring-[#c3c3ee]/50"
            style={{
              backgroundColor: '#1f1f26',
              borderColor: '#484750',
            }}
            aria-label={t('voicePreview')}
          >
            {VOICE_OPTIONS.map((voice) => (
              <option key={voice} value={voice}>
                {t(`voices.${voice}`)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#acaab5]"
            size={18}
            aria-hidden="true"
          />
        </div>
        <div
          className="mt-3 flex items-center gap-3 rounded-lg border p-2"
          style={{
            backgroundColor: 'rgba(78, 79, 116, 0.2)',
            borderColor: 'rgba(195, 195, 238, 0.2)',
          }}
        >
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c3c3ee] text-[#3c3d61]"
            aria-label={t('playVoicePreview')}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
          </button>
          <div
            className="relative h-1 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: '#25252e' }}
            role="progressbar"
            aria-valuenow={33}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('voiceProgress')}
          >
            <div
              className="absolute inset-0"
              style={{
                width: '33%',
                backgroundColor: 'rgba(195, 195, 238, 0.4)',
              }}
            />
          </div>
        </div>
      </section>

      {/* Visual Style */}
      <section>
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#acaab5]">
          {t('visualStyle')}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {VISUAL_STYLES.map((style) => {
            const isSelected = selectedStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onStyleChange(style.id)}
                className={`group relative overflow-hidden rounded-lg transition-all ${
                  isSelected
                    ? 'border-2 border-[#c3c3ee] bg-[#c3c3ee]/5'
                    : 'border bg-[#1f1f26] hover:border-[#c3c3ee]/50'
                }`}
                style={!isSelected ? { borderColor: '#484750' } : undefined}
                aria-label={t(`visualStyles.${style.id}`)}
                aria-pressed={isSelected}
              >
                <div className="h-16 w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={style.imageUrl}
                    alt={t(`visualStyles.${style.id}`)}
                    className={`h-full w-full object-cover transition-all ${
                      isSelected ? 'opacity-80' : 'opacity-40 group-hover:opacity-60'
                    }`}
                  />
                </div>
                <div className="p-2 text-center">
                  <span
                    className={`text-[11px] font-bold ${
                      isSelected ? 'text-[#c3c3ee]' : 'text-[#acaab5]'
                    }`}
                  >
                    {t(`visualStyles.${style.id}`)}
                  </span>
                </div>
                {isSelected && (
                  <div className="absolute right-1 top-1" aria-hidden="true">
                    <CheckCircle className="h-4 w-4 text-[#c3c3ee]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
