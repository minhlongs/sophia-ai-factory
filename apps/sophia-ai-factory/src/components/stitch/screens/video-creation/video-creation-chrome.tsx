'use client';

// i18n-namespace: stitch.video-creation

import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { VideoStepper } from './video-stepper';

export interface VideoCreationHeaderProps {
  currentStep: number;
  onBack: () => void;
  t: (key: string) => string;
}

export function VideoCreationHeader({
  currentStep,
  onBack,
  t,
}: VideoCreationHeaderProps) {
  return (
    <header className="border-b border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] px-4 py-2 md:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('back')}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground dark:text-white md:text-lg">
              {t('title')}
            </h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              {t('subtitle')}
            </p>
          </div>
        </div>
      </div>
      <VideoStepper currentStep={currentStep} />
    </header>
  );
}

export interface VideoCreationFooterProps {
  onBack: () => void;
  onContinue: () => void;
  t: (key: string) => string;
}

export function VideoCreationFooter({
  onBack,
  onContinue,
  t,
}: VideoCreationFooterProps) {
  return (
    <footer className="flex items-center justify-between border-t border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] px-4 py-4 md:px-8">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 rounded-lg border border-border dark:border-white/[0.08] px-6 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-foreground/30 hover:text-foreground dark:hover:text-white"
        aria-label={t('back')}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('back')}
      </button>
      <button
        type="button"
        onClick={onContinue}
        className="flex items-center gap-2 rounded-lg bg-primary px-8 py-2.5 font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
        aria-label={t('continueToVoice')}
      >
        {t('continueToVoice')}
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </footer>
  );
}
