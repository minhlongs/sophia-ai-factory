'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle } from 'lucide-react';
import { VISUAL_STYLES } from './video-creation-types';
import { VideoPreviewMonitor, VoicePreviewSelector } from './video-preview-sections';

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
      className="hidden w-[320px] flex-shrink-0 overflow-y-auto border-l border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] p-4 md:block lg:p-6 stitch-scrollbar"
      aria-label={t('sidebarLabel')}
    >
      <VideoPreviewMonitor />

      <VoicePreviewSelector
        selectedVoice={selectedVoice}
        onVoiceChange={onVoiceChange}
      />

      {/* Visual Style */}
      <section>
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
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
                    ? 'border-2 border-primary bg-primary/5'
                    : 'border border-border dark:border-white/[0.08] bg-background dark:bg-[#090A10] hover:border-primary/50'
                }`}
                aria-label={t(`visualStyles.${style.id}`)}
                aria-pressed={isSelected}
              >
                <div className="h-16 w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={style.imageUrl}
                    alt={t(`visualStyles.${style.id}`)}
                    className={`h-full w-full object-cover transition-all ${
                      isSelected ? 'opacity-85' : 'opacity-50 group-hover:opacity-75'
                    }`}
                  />
                </div>
                <div className="p-2 text-center">
                  <span
                    className={`text-[11px] font-bold ${
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {t(`visualStyles.${style.id}`)}
                  </span>
                </div>
                {isSelected && (
                  <div className="absolute right-1 top-1" aria-hidden="true">
                    <CheckCircle className="h-4 w-4 text-primary" />
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
