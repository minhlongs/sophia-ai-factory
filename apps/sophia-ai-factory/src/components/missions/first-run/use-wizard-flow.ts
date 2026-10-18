'use client';

/**
 * First-Run Wizard Flow & Polling Hook
 * Layer: components/missions (UI Presentation)
 *
 * @module components/missions/first-run/use-wizard-flow
 */

// i18n-namespace: dashboard.missions.wizard

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FirstRunTemplate } from '@/land/missions/first-run-template';
import { estimateTemplateCost } from '@/land/missions/cost-estimator';
import type { MissionStageId } from '../mission-progress-bar';
import { estimateBlueprintStudioCost } from '@/tree/marketplace/preflight-cost-engine';
import { type FirstRunWizardProps, type WizardStatus } from './types';
import { launchWizardMission } from './wizard-launch-helper';
import { pollWizardTrackStep } from './wizard-poll-helper';

export function useWizardFlow(
  props: FirstRunWizardProps,
  templates: FirstRunTemplate[],
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const { workspaceId, locale = 'vi', initialBlueprint, initialMcuBalance = 0, userTier = 'BASIC' } = props;

  const [selectedTemplate, setSelectedTemplate] = useState<FirstRunTemplate>(templates[0]);
  const [topic, setTopic] = useState<string>(initialBlueprint?.title || selectedTemplate.defaultTopic[locale]);
  const [status, setStatus] = useState<WizardStatus>('idle');
  const [currentStage, setCurrentStage] = useState<MissionStageId>('SCRIPT_GENERATION');
  const [missionId, setMissionId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const blueprintCost = initialBlueprint
    ? estimateBlueprintStudioCost(initialBlueprint.estimatedScenes, initialBlueprint.estimatedDurationSeconds, 3)
    : null;
  const isAllowed = !blueprintCost || userTier === 'MASTER' || initialMcuBalance >= blueprintCost.totalMCU;
  const missingMcu = blueprintCost && !isAllowed ? blueprintCost.totalMCU - initialMcuBalance : 0;

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
    await pollWizardTrackStep({
      targetMissionId,
      isMounted: () => isMountedRef.current,
      getPollStartedAt: () => pollStartRef.current,
      t,
      setStatus,
      setCurrentStage,
      setErrorMessage,
      clearPolling,
      scheduleNextPoll: (delayMs) => {
        pollTimeoutRef.current = setTimeout(() => void pollTrackStatus(targetMissionId), delayMs);
      },
    });
  }, [t, clearPolling]);

  const handleLaunch = async () => {
    if (!isAllowed) {
      setStatus('failed');
      setErrorMessage(t('insufficientMcu', { missing: missingMcu }));
      return;
    }
    clearPolling();
    setStatus('running');
    setCurrentStage('SCRIPT_GENERATION');
    setErrorMessage('');
    pollStartRef.current = Date.now();

    const budgetCents = blueprintCost ? blueprintCost.totalCostCents : Math.round(costEstimate.totalUsd * 100);
    await launchWizardMission({
      workspaceId,
      topic,
      selectedTemplate,
      locale,
      budgetCents,
      estimatedUsd: blueprintCost ? blueprintCost.estimatedUsd : costEstimate.totalUsd,
      initialBlueprint,
      isMounted: () => isMountedRef.current,
      onCreated: (newId) => {
        setMissionId(newId);
        pollTimeoutRef.current = setTimeout(() => void pollTrackStatus(newId), 500);
      },
      onError: (msg) => {
        setStatus('failed');
        setErrorMessage(msg);
        clearPolling();
      },
      defaultLaunchError: t('launchError'),
    });
  };

  return {
    selectedTemplate, setSelectedTemplate,
    topic, setTopic,
    status, setStatus,
    currentStage, missionId, errorMessage,
    blueprintCost, isAllowed, missingMcu, costEstimate,
    handleLaunch,
  };
}
