'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Sparkles,
  Play,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CheckCircle,
  FileText,
  Mic,
  Film,
  Eye,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const MAX_CHARS = 5000;
const TOTAL_STEPS = 4; // eslint-disable-line @typescript-eslint/no-unused-vars

const STEPS = [
  { id: 1, key: 'script', Icon: FileText },
  { id: 2, key: 'voice', Icon: Mic },
  { id: 3, key: 'visual', Icon: Film },
  { id: 4, key: 'review', Icon: Eye },
] as const;

const VOICE_OPTIONS = ['aria', 'marcus', 'sophia', 'nova'] as const;

const VISUAL_STYLES = [
  {
    id: 'cinematic',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAF8Xgl8ZhCH1k3nzBb-Y81eMaLvYxSwbpUFtCvm7LULuoGcP_ptv9895uo-PpT85xDqwU_giF60-lHlEf8CXt-uSbEOvHEjFG1sLYEf-ue22GvKKrKz12YdvTQrV1BBmL6-KPuo6zZFNtwk-XlTgU1wTNti6B2wSPYsQpQug9RThUkIOLK4dBQaQEKGpXqJ5jOty1kV0OMAUQ57QfFKYQWeiuol86mFH2Bo9QA5SeMxrA4noOEDEz1fxm3BpcJHdK59Q24Wf7q-QQ',
  },
  {
    id: 'template',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDnGaalII0NvHAxDhIZQqr2Y9Cz69dKxQ-n6WZIoDxWhWQbkLDPzZdGENsCl-wWrR4lTeg0R-_gw8USc25Us41xS7mLCRTX7svzDhisx9yQN0AAelFoWESeW32N7z-hyXCGkDobOzMTqDH01AuJS5EaAyhfyYr7sYQ1iztKR9u8_Y3I0Zsuy15ypqENz8uIsvj0_wzCWc1Pzl3T0i6D1EKdsYTeu9HFvPhINRyhitJY5GeL5-X_ETBVDr_-qpI6d5OfXnUuG2XjKOA',
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface VideoCreationPageProps {
  /** Initial script content */
  initialScript?: string;
  /** Current step (1-based, defaults to 1 = Script) */
  currentStep?: number;
  /** Callback when user clicks Continue */
  onContinue?: () => void;
  /** Callback when user clicks Back */
  onBack?: () => void;
  /** Callback when user clicks AI Generate */
  onAIGenerate?: (script: string) => void;
}

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
      <style>{`
        .stitch-scrollbar::-webkit-scrollbar { width: 4px; }
        .stitch-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .stitch-scrollbar::-webkit-scrollbar-thumb { background: #484750; border-radius: 10px; }
      `}</style>

      <div className="flex h-screen flex-col overflow-hidden bg-[#0e0e12] text-[#e7e4f0]">
        {/* ── Main Content + Sidebar ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Content Panel ── */}
          <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-8 stitch-scrollbar">
            {/* Header + Stepper */}
            <div className="mb-8">
              <h1 className="mb-6 text-[28px] font-bold text-[#e7e4f0]">
                {t('title')}
              </h1>

              {/* Progress Stepper */}
              <nav aria-label={t('stepIndicator')} className="flex items-center gap-4">
                {STEPS.map((step, index) => {
                  const isActive = step.id === currentStep;
                  const isPast = step.id < currentStep;
                  const isLast = index === STEPS.length - 1;

                  return (
                    <React.Fragment key={step.id}>
                      <div
                        className={`flex items-center gap-2 ${!isActive && !isPast ? 'opacity-60' : ''}`}
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            isActive
                              ? 'bg-[#c3c3ee] text-[#3c3d61]'
                              : isPast
                                ? 'bg-[#c3c3ee] text-[#3c3d61]'
                                : 'bg-[#25252e] text-[#acaab5]'
                          }`}
                          aria-current={isActive ? 'step' : undefined}
                          aria-label={`${t('step')} ${step.id}`}
                        >
                          {step.id}
                        </div>
                        <span
                          className={`text-sm font-semibold ${
                            isActive ? 'text-[#e7e4f0]' : 'text-[#acaab5]'
                          }`}
                        >
                          {t(`steps.${step.key}`)}
                        </span>
                      </div>
                      {!isLast && (
                        <div className="h-px w-12 bg-[#484750]" aria-hidden="true" />
                      )}
                    </React.Fragment>
                  );
                })}
              </nav>
            </div>

            {/* ── Main Panel ── */}
            <div
              className="flex flex-col rounded-xl border"
              style={{
                backgroundColor: '#191920',
                borderColor: '#484750',
              }}
            >
              {/* Panel Header */}
              <div
                className="flex items-center justify-between border-b p-4"
                style={{ borderColor: '#484750' }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-[#acaab5]">
                  {t('scriptInput')}
                </span>
                <button
                  type="button"
                  onClick={handleAIGenerate}
                  className="group flex items-center gap-2 rounded-lg bg-[#25252e] px-4 py-2 text-sm text-[#e7e4f0] transition-all hover:bg-[#4e4f74]"
                  aria-label={t('aiGenerate')}
                >
                  <Sparkles
                    className="h-[18px] w-[18px] transition-transform group-hover:rotate-12"
                    aria-hidden="true"
                  />
                  {t('aiGenerate')}
                </button>
              </div>

              {/* Panel Body */}
              <div className="space-y-6 p-6">
                <textarea
                  value={script}
                  onChange={handleScriptChange}
                  placeholder={t('scriptPlaceholder')}
                  rows={6}
                  className="stitch-scrollbar w-full resize-none rounded-lg border bg-black p-4 text-[#e7e4f0] placeholder-[#acaab5] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#c3c3ee]"
                  style={{ borderColor: '#484750' }}
                  aria-label={t('scriptInput')}
                />

                {/* Generated Script Preview */}
                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#acaab5]">
                    {t('generatedPreview')}
                  </h3>
                  <div
                    className="stitch-scrollbar max-h-64 overflow-y-auto rounded-lg border p-4 leading-relaxed md:p-6"
                    style={{
                      backgroundColor: '#131318',
                      borderColor: '#484750',
                      color: 'rgba(231, 228, 240, 0.8)',
                    }}
                  >
                    {script.trim() ? (
                      <p className="text-sm">{script}</p>
                    ) : (
                      <div className="space-y-4 text-sm">
                        <p>{t('previewPlaceholder1')}</p>
                        <p>{t('previewPlaceholder2')}</p>
                        <p>{t('previewPlaceholder3')}</p>
                        <p>{t('previewPlaceholder4')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Panel Footer — Character Count */}
              <div
                className="rounded-b-xl border-t p-4"
                style={{
                  borderColor: '#484750',
                  backgroundColor: 'rgba(25, 25, 32, 0.5)',
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-[#acaab5]">
                    {t('characterCount', {
                      current: charCount.toLocaleString(),
                      max: MAX_CHARS.toLocaleString(),
                    })}
                  </span>
                  <span className="text-xs font-medium text-[#c3c3ee]">
                    {t('percentUsed', { percent: percentUsed })}
                  </span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: '#25252e' }}
                  role="progressbar"
                  aria-valuenow={percentUsed}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('characterProgress', { percent: percentUsed })}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percentUsed}%`,
                      backgroundColor: '#c3c3ee',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Sidebar ── */}
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
                  onChange={(e) => setSelectedVoice(e.target.value)}
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
                      onClick={() => setSelectedStyle(style.id)}
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
        </div>

        {/* ── Bottom Action Bar ── */}
        <footer
          className="flex items-center justify-between border-t px-4 py-4 shadow-lg md:px-8"
          style={{
            backgroundColor: '#1f1f26',
            borderColor: '#484750',
          }}
        >
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#acaab5] transition-colors hover:text-[#e7e4f0]"
            aria-label={t('back')}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            {t('back')}
          </button>

          {/* Step Tabs (desktop only) */}
          <nav
            className="hidden items-center gap-8 md:flex"
            aria-label={t('stepNavigation')}
          >
            {STEPS.map((step) => {
              const isActive = step.id === currentStep;
              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center justify-center px-6 py-1 ${
                    isActive
                      ? 'rounded-xl bg-[#c3c3ee] text-[#3c3d61]'
                      : 'text-[#acaab5] transition-transform duration-300 hover:text-[#e7e4f0]'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={t(`steps.${step.key}`)}
                >
                  <step.Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-xs font-medium">
                    {t(`steps.${step.key}`)}
                  </span>
                </div>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleContinue}
            className="flex items-center gap-2 rounded-lg bg-[#c3c3ee] px-8 py-2.5 font-bold text-[#3c3d61] shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{
              boxShadow: '0 10px 15px -3px rgba(195, 195, 238, 0.2)',
            }}
            aria-label={t('continueToVoice')}
          >
            {t('continueToVoice')}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </footer>
      </div>
    </>
  );
}
