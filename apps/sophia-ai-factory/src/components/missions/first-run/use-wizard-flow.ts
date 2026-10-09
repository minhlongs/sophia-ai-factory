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
import { createMission, getMissionTrackStatus } from '@/land/creative-mission/actions';
import { estimateBlueprintStudioCost } from '@/tree/marketplace/preflight-cost-engine';
import {
  type FirstRunWizardProps,
  type WizardStatus,
  POLL_INTERVAL_MS,
  MAX_POLL_TIMEOUT_MS,
  STAGE_TO_KEY,
} from './types';
import { mapTrackStatusToStage } from './stage-resolver';
import {
  buildCreateMissionInput,
  resolveExecutionTemplate,
  triggerExecutionAction,
} from './execution-helper';

export function useWizardFlow(
  props: FirstRunWizardProps,
  templates: FirstRunTemplate[],
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const {
    workspaceId,
    locale = 'vi',
    initialBlueprint,
    initialMcuBalance = 0,
    userTier = 'BASIC',
  } = props;

  const [selectedTemplate, setSelectedTemplate] = useState<FirstRunTemplate>(templates[0]);
  const [topic, setTopic] = useState<string>(
    initialBlueprint?.title || selectedTemplate.defaultTopic[locale],
  );
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
          setErrorMessage(t('stageFailureMessage', { stage: t(`stages.${stageKey}.label`) }));
          clearPolling();
          return;
        }
      }
      pollTimeoutRef.current = setTimeout(() => {
        void pollTrackStatus(targetMissionId);
      }, POLL_INTERVAL_MS);
    } catch {
      if (!isMountedRef.current) return;
      pollTimeoutRef.current = setTimeout(() => {
        void pollTrackStatus(targetMissionId);
      }, POLL_INTERVAL_MS);
    }
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

    try {
      const budgetCents = blueprintCost ? blueprintCost.totalCostCents : Math.round(costEstimate.totalUsd * 100);
      const missionInput = buildCreateMissionInput({
        workspaceId,
        topic,
        template: selectedTemplate,
        locale,
        budgetCents,
        blueprint: initialBlueprint,
      });

      const createRes = await createMission(missionInput);

      if (!createRes.ok) {
        setStatus('failed');
        setErrorMessage(createRes.error.message || t('launchError'));
        return;
      }

      const newId = createRes.value.missionId;
      setMissionId(newId);
      pollTimeoutRef.current = setTimeout(() => void pollTrackStatus(newId), 500);

      const execTmpl = resolveExecutionTemplate(selectedTemplate, initialBlueprint);

      triggerExecutionAction(
        newId,
        topic,
        execTmpl,
        blueprintCost ? blueprintCost.estimatedUsd : costEstimate.totalUsd,
        () => isMountedRef.current,
        (execError) => {
          if (execError) {
            setStatus('failed');
            setErrorMessage(execError);
            clearPolling();
          }
        },
      );
    } catch {
      setStatus('failed');
      setErrorMessage(t('launchError'));
    }
  };

  return {
    selectedTemplate,
    setSelectedTemplate,
    topic,
    setTopic,
    status,
    setStatus,
    currentStage,
    missionId,
    errorMessage,
    blueprintCost,
    isAllowed,
    missingMcu,
    costEstimate,
    handleLaunch,
  };
}
