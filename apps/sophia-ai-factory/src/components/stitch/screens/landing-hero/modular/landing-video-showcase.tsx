'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Play, Sparkles, Layers, Mic, ArrowRight } from 'lucide-react';
import { Link } from '@/navigation';

type ShowcaseTabId = 'glean-agents' | 'bolt-skills' | 'voice-input';

interface ShowcaseItem {
  readonly id: ShowcaseTabId;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly durationLabel: string;
}

const SHOWCASE_ITEMS: readonly ShowcaseItem[] = [
  { id: 'glean-agents', icon: Sparkles, durationLabel: '1:01' },
  { id: 'bolt-skills', icon: Layers, durationLabel: '0:43' },
  { id: 'voice-input', icon: Mic, durationLabel: '0:21' },
] as const;

export function LandingVideoShowcase() {
  const t = useTranslations('stitch.landing.videoShowcase');
  const locale = useLocale();
  const lang = locale === 'vi' ? 'vi' : 'en';
  const [activeTab, setActiveTab] = useState<ShowcaseTabId>('glean-agents');

  const activeItem =
    SHOWCASE_ITEMS.find((item) => item.id === activeTab) ?? SHOWCASE_ITEMS[0];
  const videoSrc = `/videos/sophia-${activeItem.id}-${lang}.mp4`;

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % SHOWCASE_ITEMS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + SHOWCASE_ITEMS.length) % SHOWCASE_ITEMS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = SHOWCASE_ITEMS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const nextItem = SHOWCASE_ITEMS[nextIndex];
    setActiveTab(nextItem.id);
    const nextButton = document.getElementById(`showcase-tab-${nextItem.id}`);
    nextButton?.focus();
  };

  return (
    <section
      id="video-showcase"
      aria-labelledby="video-showcase-heading"
      className="relative py-16 md:py-24 px-6"
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '680px',
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-[var(--primary-container)] text-[var(--on-primary-container)] mb-4">
          <Play className="w-3.5 h-3.5" aria-hidden="true" />
          {t('kicker')}
        </span>

        <h2
          id="video-showcase-heading"
          className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--on-surface)] max-w-3xl"
        >
          {t('title')}
        </h2>

        <p className="mt-3 text-base md:text-lg text-[var(--on-surface-variant)] max-w-2xl">
          {t('subtitle')}
        </p>

        {/* MD3 Expressive Segmented Pill Tabs */}
        <div
          role="tablist"
          aria-label={t('tablistLabel')}
          className="mt-8 inline-flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-full bg-[var(--surface-container-low)] border border-[var(--outline-variant)]"
        >
          {SHOWCASE_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isSelected = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`showcase-tab-${item.id}`}
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-controls="video-showcase-panel"
                onClick={() => setActiveTab(item.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={[
                  'inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] cursor-pointer',
                  isSelected
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-sm'
                    : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]',
                ].join(' ')}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t(`tabs.${item.id}.label`)}</span>
                <span
                  className={[
                    'text-xs font-mono px-1.5 py-0.5 rounded-full',
                    isSelected
                      ? 'bg-[var(--on-primary)]/20 text-[var(--on-primary)]'
                      : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]',
                  ].join(' ')}
                >
                  {item.durationLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Studio Dark Stage 16:9 Video Container */}
        <div
          id="video-showcase-panel"
          role="tabpanel"
          aria-labelledby={`showcase-tab-${activeItem.id}`}
          className="mt-8 w-full rounded-[28px] overflow-hidden border border-[var(--studio-stage-border)] bg-[var(--studio-stage-bg)] shadow-sm"
        >
          <div className="relative aspect-video w-full bg-[var(--studio-stage-bg)]">
            <video
              key={videoSrc}
              src={videoSrc}
              controls
              playsInline
              preload="metadata"
              aria-label={t(`tabs.${activeItem.id}.title`)}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 bg-[var(--studio-stage-panel)] border-t border-[var(--studio-stage-border)] text-left">
            <div>
              <h3 className="text-base font-semibold text-[var(--studio-stage-fg)]">
                {t(`tabs.${activeItem.id}.title`)}
              </h3>
              <p className="mt-0.5 text-sm text-[var(--studio-stage-fg)]/75">
                {t(`tabs.${activeItem.id}.description`)}
              </p>
            </div>

            <Link
              href="/signup"
              className="shrink-0 inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-95 transition-opacity motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              <span>{t('cta')}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingVideoShowcase;
