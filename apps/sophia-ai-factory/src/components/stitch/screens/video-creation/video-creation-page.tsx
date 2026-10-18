'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ScriptPanel } from './script-panel';
import { VideoPreviewSidebar } from './video-preview-sidebar';
import { VideoCreationHeader, VideoCreationFooter } from './video-creation-chrome';
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
      <VideoCreationHeader
        currentStep={currentStep}
        onBack={handleBack}
        t={t}
      />

      <div className="flex flex-1 overflow-hidden bg-background dark:bg-[#090A10]">
        <ScriptPanel
          script={script}
          charCount={charCount}
          percentUsed={percentUsed}
          onScriptChange={handleScriptChange}
          onAIGenerate={handleAIGenerate}
        />

        <VideoPreviewSidebar
          selectedVoice={selectedVoice}
          selectedStyle={selectedStyle}
          onVoiceChange={setSelectedVoice}
          onStyleChange={setSelectedStyle}
        />
      </div>

      <VideoCreationFooter
        onBack={handleBack}
        onContinue={handleContinue}
        t={t}
      />
    </>
  );
}
