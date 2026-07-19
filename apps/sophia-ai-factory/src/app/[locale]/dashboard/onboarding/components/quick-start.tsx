'use client';

/**
 * QuickStart — 4-step card checklist for first-video onboarding.
 *
 * Shown after the BYOK setup wizard is complete. Guides the user through
 * connecting API keys, selecting a template, generating their first video
 * with one click, and sharing the result.
 *
 * @module app/[locale]/dashboard/onboarding/components/quick-start
 */

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  CheckCircle2,
  Circle,
  Wifi,
  Film,
  Play,
  Share2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { generateFirstVideoAction } from '@/app/actions/generate-first-video-action';
import type { GenerateFirstVideoResult } from '@/app/actions/generate-first-video-action';

interface QuickStartProps {
  wizardComplete: boolean;
}

type StepStatus = 'done' | 'current' | 'todo';
type GenerationStatus = 'idle' | 'generating' | 'ready' | 'error';

interface StepData {
  status: StepStatus;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function StepIcon({ done }: { done: boolean }) {
  return done ? (
    <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" aria-hidden="true" />
  ) : (
    <Circle className="h-6 w-6 text-muted-foreground shrink-0" aria-hidden="true" />
  );
}

function calcStepBorder(status: StepStatus): string {
  if (status === 'done') return 'border-green-500/40 bg-green-500/5';
  if (status === 'current') return 'border-primary/60 bg-primary/5 ring-1 ring-primary/20';
  return 'border-border opacity-60';
}

export function QuickStart({ wizardComplete }: QuickStartProps) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const [genStatus, setGenStatus] = useState<GenerationStatus>('idle');
  const [genError, setGenError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const stepDone = [
    wizardComplete, // step 1: Connect API Keys
    true, // step 2: Template auto-selected
    genStatus === 'ready', // step 3: Video generated
    false, // step 4: Share (manual action)
  ];

  const firstPendingIdx = stepDone.findIndex((d) => !d);

  function getStatus(idx: number): StepStatus {
    if (stepDone[idx]) return 'done';
    if (idx === firstPendingIdx) return 'current';
    return 'todo';
  }

  const handleGenerate = async () => {
    setGenStatus('generating');
    setGenError(null);
    try {
      const result: GenerateFirstVideoResult = await generateFirstVideoAction();
      if (result.success && result.videoId) {
        setGenStatus('ready');
        setVideoId(result.videoId);
      } else {
        setGenStatus('error');
        setGenError(result.error ?? t('quickStartGenFailed'));
      }
    } catch {
      setGenStatus('error');
      setGenError(t('quickStartGenFailed'));
    }
  };

  const steps: StepData[] = [
    {
      status: getStatus(0),
      icon: <Wifi className="h-3.5 w-3.5" />,
      title: t('stepConnectKeys'),
      description: t('stepConnectKeysDesc'),
    },
    {
      status: getStatus(1),
      icon: <Film className="h-3.5 w-3.5" />,
      title: t('stepChooseTemplate'),
      description: t('stepChooseTemplateDesc'),
    },
    {
      status: getStatus(2),
      icon: <Play className="h-3.5 w-3.5" />,
      title: t('stepGenerateVideo'),
      description: t('stepGenerateVideoDesc'),
    },
    {
      status: getStatus(3),
      icon: <Share2 className="h-3.5 w-3.5" />,
      title: t('stepShareResults'),
      description: t('stepShareResultsDesc'),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-2">
        <h2 className="text-2xl font-bold">{t('quickStart')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('quickStartDesc')}</p>
      </div>

      {steps.map((step, i) => (
        <div
          key={i}
          className={`rounded-lg border p-5 transition-all ${calcStepBorder(step.status)}`}
        >
          <div className="flex items-start gap-4">
            <StepIcon done={step.status === 'done'} />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base leading-tight">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>

              {/* Step 1 action: complete setup */}
              {i === 0 && step.status === 'current' && (
                <a
                  href={`/${locale}/dashboard/onboarding`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  {t('completeSetup')}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}

              {/* Step 2: auto-selected badge */}
              {i === 1 && (
                <p className="mt-2 text-xs font-medium text-primary">{t('templateAutoSelected')}</p>
              )}

              {/* Step 3: generate button or status */}
              {i === 2 && genStatus === 'idle' && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Play className="w-4 h-4" aria-hidden="true" />
                  {t('generateFirstVideo')}
                </button>
              )}
              {i === 2 && genStatus === 'generating' && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>{t('generatingVideo')}</span>
                </div>
              )}
              {i === 2 && genStatus === 'ready' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t('videoReady')}
                  </span>
                  {videoId && (
                    <a
                      href={`/${locale}/dashboard/videos/${videoId}`}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground px-3 py-1 text-xs font-medium hover:bg-secondary/80 transition-colors"
                    >
                      {t('viewVideo')}
                    </a>
                  )}
                </div>
              )}
              {i === 2 && genStatus === 'error' && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs text-destructive">{genError}</p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground px-3 py-1 text-xs font-medium hover:bg-secondary/80 transition-colors self-start"
                  >
                    {t('quickStartRetry')}
                  </button>
                </div>
              )}

              {/* Step 4: connect channels */}
              {i === 3 && genStatus === 'ready' && (
                <a
                  href={`/${locale}/dashboard/integrations/channels`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('connectChannels')}
                </a>
              )}
            </div>

            {step.status === 'done' && (
              <span className="text-xs text-green-600 font-medium shrink-0">{t('quickStartDone')}</span>
            )}
          </div>
        </div>
      ))}

      <div className="mt-2 text-center">
        <a
          href={`/${locale}/dashboard`}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          {t('goToDashboard')}
        </a>
      </div>
    </div>
  );
}
