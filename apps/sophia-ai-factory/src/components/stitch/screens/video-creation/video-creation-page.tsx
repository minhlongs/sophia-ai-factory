'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { VideoStepper } from './video-stepper';
import { ScriptPanel } from './script-panel';
import { VideoPreviewSidebar } from './video-preview-sidebar';
import { MAX_CHARS } from './video-creation-types';
import type { VideoCreationPageProps } from './video-creation-types';

// Re-export extracted modules for barrel compatibility
export type { VideoCreationPageProps } from './video-creation-types';
export { MAX_CHARS, STEPS, VOICE_OPTIONS, VISUAL_STYLES } from './video-creation-types';
export { VideoStepper } from './video-stepper';
export { ScriptPanel } from './script-panel';
export { VideoPreviewSidebar } from './video-preview-sidebar';

/* ------------------------------------------------------------------ */
/*  VideoCreationPage                                                  */
/* ------------------------------------------------------------------ */

export default function VideoCreationPage({
  initialScript = '',
  currentStep = 1,
  onContinue,
  onBack,
  onAIGenerate,
}: VideoCreationPageProps) {
  const t = useTranslations('stitch.video-creation');

  const [script, setScript] = useState(initialScript);
  const [selectedVoice, setSelectedVoice] = useState('aria');
  const [selectedStyle, setSelectedStyle] = useState('cinematic');

  const charCount = script.length;
  const percentUsed = useMemo(
    () => Math.min(Math.round((charCount / MAX_CHARS) * 100), 100),
    [charCount],
  );

  const handleScriptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= MAX_CHARS) {
        setScript(value);
      }
    },
    [],
  );

  const handleAIGenerate = useCallback(() => {
    onAIGenerate?.(script);
  }, [script, onAIGenerate]);

  const handleContinue = useCallback(() => {
    onContinue?.();
  }, [onContinue]);

  const handleBack = useCallback(() => {
    onBack?.();
  }, [onBack]);

  return (
    <>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header
        className="border-b border-border bg-background px-4 py-2 md:px-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('back')}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-base font-bold text-foreground md:text-lg">
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

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div
        className="flex flex-1 overflow-hidden"
        style={{ backgroundColor: '#131318' }}
      >
        {/* ── Script Panel ── */}
        <ScriptPanel
          script={script}
          charCount={charCount}
          percentUsed={percentUsed}
          onScriptChange={handleScriptChange}
          onAIGenerate={handleAIGenerate}
        />

        {/* ── Sidebar ── */}
        <VideoPreviewSidebar
          selectedVoice={selectedVoice}
          selectedStyle={selectedStyle}
          onVoiceChange={setSelectedVoice}
          onStyleChange={setSelectedStyle}
        />
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer
        className="flex items-center justify-between border-t px-4 py-4 md:px-8"
        style={{
          backgroundColor: '#131318',
          borderColor: '#484750',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-muted-foreground hover:text-foreground"
          aria-label={t('back')}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('back')}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className="flex items-center gap-2 rounded-lg bg-primary px-8 py-2.5 font-bold text-primary-foreground shadow-lg transition-all hover:scale-105 active:scale-95"
          aria-label={t('continueToVoice')}
        >
          {t('continueToVoice')}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </footer>
    </>
  );
}
