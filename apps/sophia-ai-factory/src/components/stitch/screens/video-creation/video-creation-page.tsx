'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Sparkles,
  Play,
  PlayCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CheckCircle,
  FileText,
  Mic,
  Film,
  Eye,
} from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Progress } from '@/seed/components/ui/progress';
import { Textarea } from '@/seed/components/ui/textarea';
import { cn } from '@/seed/utils/cn';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const MAX_CHARS = 5000;
const TOTAL_STEPS = 4;

const STEPS = [
  { id: 1, key: 'script', Icon: FileText },
  { id: 2, key: 'voice', Icon: Mic },
  { id: 3, key: 'visual', Icon: Film },
  { id: 4, key: 'review', Icon: Eye },
] as const;

const VOICE_OPTIONS = [
  'aria',
  'marcus',
  'sophia',
  'nova',
] as const;

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
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Main Content Area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Content Panel */}
        <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-8 scrollbar-thin">
          {/* Header + Stepper */}
          <div className="mb-6 md:mb-8">
            <h1 className="mb-6 text-[28px] font-bold text-foreground">
              {t('title')}
            </h1>

            {/* Progress Stepper */}
            <nav aria-label={t('stepIndicator')} className="flex items-center gap-4">
              {STEPS.map((step, index) => {
                const isActive = step.id === 1;
                const isLast = index === STEPS.length - 1;

                return (
                  <React.Fragment key={step.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                        aria-current={isActive ? 'step' : undefined}
                        aria-label={`${t('step')} ${step.id}`}
                      >
                        {step.id}
                      </div>
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          isActive ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {t(`steps.${step.key}`)}
                      </span>
                    </div>
                    {!isLast && (
                      <div
                        className="h-px w-8 md:w-12 bg-border"
                        aria-hidden="true"
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* Main Panel — Script Input */}
          <Card className="flex flex-col rounded-xl border-border bg-card">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('scriptInput')}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAIGenerate}
                className="gap-2"
                aria-label={t('aiGenerate')}
              >
                <Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />
                {t('aiGenerate')}
              </Button>
            </div>

            {/* Panel Body */}
            <CardContent className="space-y-6 p-6">
              <Textarea
                value={script}
                onChange={handleScriptChange}
                placeholder={t('scriptPlaceholder')}
                rows={6}
                className="scrollbar-thin min-h-[140px] resize-none border-border bg-card p-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                aria-label={t('scriptInput')}
              />

              {/* Generated Script Preview */}
              <div>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('generatedPreview')}
                </h3>
                <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-lg border border-border bg-muted p-4 md:p-6 leading-relaxed text-foreground/80">
                  {script.trim() ? (
                    <p className="text-sm">{script}</p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <p>{t('previewPlaceholder1')}</p>
                      <p>{t('previewPlaceholder2')}</p>
                      <p>{t('previewPlaceholder3')}</p>
                      <p>{t('previewPlaceholder4')}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>

            {/* Panel Footer — Character Count */}
            <div className="rounded-b-xl border-t border-border bg-muted/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t('characterCount', {
                    current: charCount.toLocaleString(),
                    max: MAX_CHARS.toLocaleString(),
                  })}
                </span>
                <span className="text-xs font-medium text-primary">
                  {t('percentUsed', { percent: percentUsed })}
                </span>
              </div>
              <Progress
                value={percentUsed}
                max={100}
                className="h-1.5 w-full rounded-full bg-muted"
                indicatorClassName="bg-primary rounded-full"
                role="progressbar"
                aria-valuenow={percentUsed}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('characterProgress', { percent: percentUsed })}
              />
            </div>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <aside
          className="hidden w-[320px] flex-shrink-0 overflow-y-auto border-l border-border bg-muted p-4 md:block lg:p-6 scrollbar-thin"
          aria-label={t('sidebarLabel')}
        >
          {/* Preview */}
          <section className="mb-8">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('preview')}
            </h3>
            <div className="group relative cursor-pointer overflow-hidden rounded-xl border border-border">
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <PlayCircle className="h-12 w-12" aria-hidden="true" />
                </div>
              </div>
              <div
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              >
                <Play className="h-12 w-12 text-white" aria-hidden="true" />
              </div>
              <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-mono text-white backdrop-blur-sm">
                {t('previewDuration')}
              </div>
            </div>
          </section>

          {/* Voice Preview */}
          <section className="mb-8">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('voicePreview')}
            </h3>
            <div className="relative">
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-card px-4 py-2.5 pr-10 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
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
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-2">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                aria-label={t('playVoicePreview')}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
              </button>
              <div
                className="relative h-1 flex-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={33}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('voiceProgress')}
              >
                <div
                  className="absolute inset-0 bg-primary/40"
                  style={{ width: '33%' }}
                />
              </div>
            </div>
          </section>

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
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      'group relative overflow-hidden rounded-lg transition-all',
                      isSelected
                        ? 'border-2 border-primary bg-primary/5'
                        : 'border border-border bg-card hover:border-primary/50',
                    )}
                    aria-label={t(`visualStyles.${style.id}`)}
                    aria-pressed={isSelected}
                  >
                    <div className="h-16 w-full overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={style.imageUrl}
                      alt={t(`visualStyles.${style.id}`)}
                      className={cn(
                        'h-full w-full object-cover transition-all',
                        isSelected ? 'opacity-80' : 'opacity-40 group-hover:opacity-60',
                      )}
                    />
                  </div>
                    <div className="p-2 text-center">
                      <span
                        className={cn(
                          'text-[11px] font-bold',
                          isSelected ? 'text-primary' : 'text-muted-foreground',
                        )}
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
      </div>

      {/* ── Bottom Action Bar ── */}
      <footer className="flex items-center justify-between border-t border-border bg-card px-4 py-4 shadow-lg md:px-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
          aria-label={t('back')}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          {t('back')}
        </Button>

        {/* Step Tabs (desktop only) */}
        <nav
          className="hidden items-center gap-6 md:flex"
          aria-label={t('stepNavigation')}
        >
          {STEPS.map((step) => {
            const isActive = step.id === 1;
            return (
              <button
                key={step.id}
                type="button"
                className={cn(
                  'flex flex-col items-center justify-center px-6 py-1 transition-transform duration-300',
                  isActive
                    ? 'rounded-xl bg-primary px-6 text-primary-foreground'
                    : 'text-muted-foreground hover:text-primary',
                )}
                aria-current={isActive ? 'step' : undefined}
                aria-label={t(`steps.${step.key}`)}
              >
                <step.Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-medium">
                  {t(`steps.${step.key}`)}
                </span>
              </button>
            );
          })}
        </nav>

        <Button
          variant="default"
          size="lg"
          onClick={handleContinue}
          className="gap-2 font-bold shadow-lg shadow-primary/20"
          aria-label={t('continueToVoice')}
        >
          {t('continueToVoice')}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Button>
      </footer>
    </div>
  );
}
