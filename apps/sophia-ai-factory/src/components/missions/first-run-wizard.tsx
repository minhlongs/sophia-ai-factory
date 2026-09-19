'use client';

/**
 * First-Run Wizard — Guided CEO Experience for First Video Generation.
 * Answers the 5 CEO questions, provides sample inputs, and manages live 5-stage creation
 * backed by real multi-track execution and live track polling.
 *
 * @module components/missions/first-run-wizard
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Clock, Coins, CheckCircle2, ArrowRight, Video } from 'lucide-react';
import { Link } from '@/navigation';
import {
  getFirstRunTemplates,
  type FirstRunTemplate,
} from '@/land/missions/first-run-template';
import { estimateTemplateCost } from '@/land/missions/cost-estimator';
import { MissionProgressBar, type MissionStageId } from './mission-progress-bar';
import {
  createMission,
  executeMultiTrackMissionAction,
  getMissionTrackStatus,
} from '@/land/creative-mission/actions';
import type { MissionTrackStatus } from '@/tree/mission';


export interface FirstRunWizardProps {
  workspaceId: string;
  userId: string;
  locale?: 'vi' | 'en';
}

export const POLL_INTERVAL_MS = 1500;
export const MAX_POLL_TIMEOUT_MS = 180_000; // 3 minutes max

export const STAGE_TO_KEY: Record<MissionStageId, string> = {
  SCRIPT_GENERATION: 'script_generation',
  VOICE_SYNTHESIS: 'voice_synthesis',
  VISUAL_GENERATION: 'visual_generation',
  VIDEO_COMPOSITING: 'video_compositing',
  READY_FOR_REVIEW: 'ready_for_review',
};

function resolveFailedStage(trackStatus?: MissionTrackStatus): {
  stage: MissionStageId;
  uiStatus: 'failed';
  failedTrack?: string;
} {
  // Check genuine failures first (root cause)
  if (trackStatus?.video === 'failed')
    return { stage: 'VIDEO_COMPOSITING', uiStatus: 'failed', failedTrack: 'video' };
  if (trackStatus?.visual === 'failed')
    return { stage: 'VISUAL_GENERATION', uiStatus: 'failed', failedTrack: 'visual' };
  if (trackStatus?.audio === 'failed')
    return { stage: 'VOICE_SYNTHESIS', uiStatus: 'failed', failedTrack: 'audio' };
  if (trackStatus?.script === 'failed')
    return { stage: 'SCRIPT_GENERATION', uiStatus: 'failed', failedTrack: 'script' };

  // If mission was cancelled, attribute to the active cancelled track
  if (trackStatus?.video === 'cancelled')
    return { stage: 'VIDEO_COMPOSITING', uiStatus: 'failed', failedTrack: 'video' };
  if (trackStatus?.visual === 'cancelled')
    return { stage: 'VISUAL_GENERATION', uiStatus: 'failed', failedTrack: 'visual' };
  if (trackStatus?.audio === 'cancelled')
    return { stage: 'VOICE_SYNTHESIS', uiStatus: 'failed', failedTrack: 'audio' };
  if (trackStatus?.script === 'cancelled')
    return { stage: 'SCRIPT_GENERATION', uiStatus: 'failed', failedTrack: 'script' };

  return { stage: 'SCRIPT_GENERATION', uiStatus: 'failed' };
}

function resolveRunningStage(
  currentPhase: string,
  trackStatus?: MissionTrackStatus,
): { stage: MissionStageId; uiStatus: 'running' | 'completed' } {
  if (trackStatus?.video === 'completed') {
    return { stage: 'READY_FOR_REVIEW', uiStatus: 'completed' };
  }
  const isVideoCompositing =
    trackStatus?.video === 'running' ||
    currentPhase === 'video_compositing' ||
    currentPhase === 'composited' ||
    (trackStatus?.audio === 'completed' && trackStatus?.visual === 'completed');
  if (isVideoCompositing) {
    return { stage: 'VIDEO_COMPOSITING', uiStatus: 'running' };
  }
  if (trackStatus?.audio === 'completed' && trackStatus?.visual === 'running') {
    return { stage: 'VISUAL_GENERATION', uiStatus: 'running' };
  }
  const isVoiceSynthesis =
    trackStatus?.script === 'completed' ||
    currentPhase === 'voice_and_visuals';
  if (isVoiceSynthesis) {
    return { stage: 'VOICE_SYNTHESIS', uiStatus: 'running' };
  }

  return { stage: 'SCRIPT_GENERATION', uiStatus: 'running' };
}

export function mapTrackStatusToStage(
  status: string,
  currentPhase: string,
  trackStatus?: MissionTrackStatus,
): { stage: MissionStageId; uiStatus: 'running' | 'completed' | 'failed'; failedTrack?: string } {
  if (status === 'review' || status === 'completed' || currentPhase === 'review') {
    return { stage: 'READY_FOR_REVIEW', uiStatus: 'completed' };
  }

  const hasFailedTrack =
    trackStatus?.video === 'failed' ||
    trackStatus?.visual === 'failed' ||
    trackStatus?.audio === 'failed' ||
    trackStatus?.script === 'failed';

  if (status === 'failed' || status === 'cancelled' || hasFailedTrack) {
    return resolveFailedStage(trackStatus);
  }

  return resolveRunningStage(currentPhase, trackStatus);
}

function CeoQuestionsGuide({
  t,
  costEstimate,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  costEstimate: { totalUsd: number; totalMcu: number };
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <p className="font-semibold text-primary">{t('guide.q1_label')}</p>
          <p className="text-muted-foreground">{t('guide.q1_desc')}</p>
        </div>
        <div>
          <p className="font-semibold text-primary">{t('guide.q2_label')}</p>
          <p className="text-muted-foreground">{t('guide.q2_desc')}</p>
        </div>
        <div>
          <p className="font-semibold text-primary">{t('guide.q3_label')}</p>
          <p className="text-muted-foreground">{t('guide.q3_desc')}</p>
        </div>
        <div>
          <p className="font-semibold text-primary">{t('guide.q4_label')}</p>
          <p className="text-muted-foreground">
            {t('guide.q4_desc', { usd: costEstimate.totalUsd, mcu: costEstimate.totalMcu })}
          </p>
        </div>
        <div>
          <p className="font-semibold text-primary">{t('guide.q5_label')}</p>
          <p className="text-muted-foreground">{t('guide.q5_desc')}</p>
        </div>
      </div>
    </div>
  );
}

function CompletionCard({
  t,
  missionId,
  onReset,
}: {
  t: (key: string) => string;
  missionId: string;
  onReset: () => void;
}) {
  return (
    <div className="rounded-xl border border-primary/30 bg-card p-6 text-center space-y-3">
      <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
      <h3 className="text-lg font-bold text-foreground">{t('successTitle')}</h3>
      <p className="text-sm text-muted-foreground">{t('successDescription')}</p>
      <div className="flex justify-center gap-3 pt-2">
        <Link
          href={`/dashboard/missions/${missionId}`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Video className="h-4 w-4" /> {t('reviewButton')}
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {t('createAnotherButton')}
        </button>
      </div>
    </div>
  );
}

interface TemplateConfiguratorProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  templates: FirstRunTemplate[];
  selectedTemplate: FirstRunTemplate;
  onSelectTemplate: (tmpl: FirstRunTemplate) => void;
  topic: string;
  onChangeTopic: (val: string) => void;
  costEstimate: { totalUsd: number; totalMcu: number };
  onLaunch: () => void;
  locale: 'vi' | 'en';
}

function TemplateConfigurator({
  t,
  templates,
  selectedTemplate,
  onSelectTemplate,
  topic,
  onChangeTopic,
  costEstimate,
  onLaunch,
  locale,
}: TemplateConfiguratorProps) {
  const getTemplateText = (
    tmpl: FirstRunTemplate,
    field: 'name' | 'description' | 'badge',
  ): string => {
    try {
      let translated = '';
      if (field === 'name') translated = t(`templates.${tmpl.id}.name`);
      else if (field === 'description') translated = t(`templates.${tmpl.id}.description`);
      else if (field === 'badge') translated = t(`templates.${tmpl.id}.badge`);
      if (translated && !translated.startsWith('templates.')) return translated;
    } catch {
      // Fall back to template model definition
    }
    return tmpl[field][locale] ?? tmpl[field].en ?? tmpl[field].vi;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
      <div>
        <label className="text-sm font-semibold text-foreground">
          {t('templateSelectLabel')}
        </label>
        <div className="mt-2.5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onSelectTemplate(tmpl)}
              className={`text-left rounded-lg p-3.5 border transition ${
                selectedTemplate.id === tmpl.id
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <span className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {getTemplateText(tmpl, 'badge')}
              </span>
              <h4 className="mt-1 font-semibold text-sm text-foreground">
                {getTemplateText(tmpl, 'name')}
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {getTemplateText(tmpl, 'description')}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-foreground">
          {t('topicLabel')}
        </label>
        <input
          type="text"
          value={topic}
          maxLength={200}
          onChange={(e) => onChangeTopic(e.target.value)}
          placeholder={selectedTemplate.defaultTopic[locale] || t('topicPlaceholder')}
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedTemplate.suggestedPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onChangeTopic(p[locale])}
              className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition"
            >
              + {p[locale]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3.5 border border-border/60 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Coins className="h-4 w-4 text-primary" />{' '}
            {t('costEstimate', {
              usd: costEstimate.totalUsd,
              mcu: costEstimate.totalMcu,
            })}
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" /> {t('durationEstimate')}
          </span>
        </div>
        <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
          ✓ {t('zeroHiddenFees')}
        </span>
      </div>

      <button
        type="button"
        onClick={onLaunch}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-[0.99]"
      >
        <Sparkles className="h-4 w-4" />
        {t('launchButton')}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function buildMissionConstraints(tmpl: FirstRunTemplate) {
  return {
    templateId: tmpl.id,
    durationSeconds: tmpl.durationSeconds,
    estimatedScenes: tmpl.estimatedScenes,
    aspectRatio: tmpl.aspectRatio,
    voiceStyle: tmpl.voiceStyle,
    visualStyle: tmpl.visualStyle,
    targetWordCount: tmpl.targetWordCount,
    targetPlatform: tmpl.targetPlatform,
  };
}

function triggerExecutionAction(
  missionId: string,
  topic: string,
  tmpl: FirstRunTemplate,
  costUsd: number,
  isMounted: () => boolean,
  onDone: (err?: string) => void,
) {
  executeMultiTrackMissionAction({
    missionId,
    topic,
    estimatedScenes: tmpl.estimatedScenes,
    durationSeconds: tmpl.durationSeconds,
    aspectRatio: tmpl.aspectRatio,
    estimatedCostCents: Math.round(costUsd * 100),
  })
    .then((execRes) => {
      if (!isMounted()) return;
      if (!execRes.ok) {
        onDone(execRes.error.message);
      } else {
        onDone();
      }
    })
    .catch((execErr) => {
      if (!isMounted()) return;
      onDone(execErr instanceof Error ? execErr.message : String(execErr));
    });
}

export function FirstRunWizard({ workspaceId, locale = 'vi' }: FirstRunWizardProps) {
  const t = useTranslations('dashboard.missions.wizard');
  const templates = getFirstRunTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<FirstRunTemplate>(templates[0]);
  const [topic, setTopic] = useState<string>(selectedTemplate.defaultTopic[locale]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [currentStage, setCurrentStage] = useState<MissionStageId>('SCRIPT_GENERATION');
  const [missionId, setMissionId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const pollStartRef = useRef<number>(0);

  const costEstimate = estimateTemplateCost(selectedTemplate.id);

  const clearPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearPolling();
    };
  }, [clearPolling]);

  const pollTrackStatus = useCallback(async (targetMissionId: string) => {
    if (!isMountedRef.current) return;

    if (Date.now() - pollStartRef.current > MAX_POLL_TIMEOUT_MS) {
      setStatus('failed');
      setErrorMessage(t('timeoutError'));
      clearPolling();
      return;
    }

    try {
      const res = await getMissionTrackStatus(targetMissionId);
      if (!isMountedRef.current) return;

      if (res.ok) {
        const { status: mStatus, currentPhase, trackStatus } = res.value;
        const mapped = mapTrackStatusToStage(mStatus, currentPhase, trackStatus);

        setCurrentStage(mapped.stage);

        if (mapped.uiStatus === 'completed') {
          setStatus('completed');
          clearPolling();
          return;
        }

        if (mapped.uiStatus === 'failed') {
          setStatus('failed');
          const stageKey = STAGE_TO_KEY[mapped.stage] || 'script_generation';
          const stageLabel = t(`stages.${stageKey}.label`);
          setErrorMessage(t('stageFailureMessage', { stage: stageLabel }));
          clearPolling();
          return;
        }

        // Still running, schedule next poll
        pollTimeoutRef.current = setTimeout(() => {
          void pollTrackStatus(targetMissionId);
        }, POLL_INTERVAL_MS);
      } else {
        // Transient error or forbidden, retry next tick
        pollTimeoutRef.current = setTimeout(() => {
          void pollTrackStatus(targetMissionId);
        }, POLL_INTERVAL_MS);
      }
    } catch {
      if (!isMountedRef.current) return;
      pollTimeoutRef.current = setTimeout(() => {
        void pollTrackStatus(targetMissionId);
      }, POLL_INTERVAL_MS);
    }
  }, [t, clearPolling]);

  const handleSelectTemplate = (tmpl: FirstRunTemplate) => {
    setSelectedTemplate(tmpl);
    setTopic(tmpl.defaultTopic[locale]);
  };

  const handleLaunch = async () => {
    clearPolling();
    setStatus('running');
    setCurrentStage('SCRIPT_GENERATION');
    setErrorMessage('');
    pollStartRef.current = Date.now();

    try {
      const now = Math.floor(Date.now() / 1000);
      const missionTitle = (topic || selectedTemplate.name[locale]).slice(0, 200);

      const createRes = await createMission({
        workspaceId,
        title: missionTitle,
        objective: `Generate autonomous ${selectedTemplate.durationSeconds}s video for ${selectedTemplate.targetPlatform}. Topic: ${topic}`,
        audience: 'General interest mobile viewers',
        geography: locale === 'vi' ? 'Vietnam' : 'Global',
        timeframeStart: now,
        timeframeEnd: now + 3600,
        budgetCents: Math.round(costEstimate.totalUsd * 100),
        autonomyLevel: 1,
        channels: [selectedTemplate.targetPlatform],
        monetizationGoals: [],
        constraints: buildMissionConstraints(selectedTemplate),
        successMetrics: { views: 1000, engagement_rate: 0.05 },
      });

      if (!createRes.ok) {
        setStatus('failed');
        setErrorMessage(createRes.error.message || t('launchError'));
        return;
      }

      const newId = createRes.value.missionId;
      setMissionId(newId);

      pollTimeoutRef.current = setTimeout(() => {
        void pollTrackStatus(newId);
      }, 500);

      triggerExecutionAction(
        newId,
        missionTitle,
        selectedTemplate,
        costEstimate.totalUsd,
        () => isMountedRef.current,
        (err) => {
          if (!isMountedRef.current) return;
          if (err) {
            clearPolling();
            setStatus('failed');
            setErrorMessage(err || t('launchError'));
          } else {
            setStatus((prev) => {
              if (prev === 'failed') return prev;
              clearPolling();
              setCurrentStage('READY_FOR_REVIEW');
              return 'completed';
            });
          }
        },
      );
    } catch {
      setStatus('failed');
      setErrorMessage(t('launchError'));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 5 Questions CEO Guide */}
      <CeoQuestionsGuide t={t} costEstimate={costEstimate} />

      {status !== 'idle' ? (
        <div className="space-y-4">
          <MissionProgressBar
            currentStage={currentStage}
            status={status}
            errorMessage={errorMessage}
            onRetry={handleLaunch}
            locale={locale}
          />
          {status === 'completed' && (
            <CompletionCard
              t={t}
              missionId={missionId}
              onReset={() => setStatus('idle')}
            />
          )}
        </div>
      ) : (
        <TemplateConfigurator
          t={t}
          templates={templates}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={handleSelectTemplate}
          topic={topic}
          onChangeTopic={setTopic}
          costEstimate={costEstimate}
          onLaunch={handleLaunch}
          locale={locale}
        />
      )}
    </div>
  );
}
