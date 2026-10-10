/**
 * Step orchestrator and lifecycle helpers for agent runs.
 * @module forest/inngest/functions/agent-ops/step-orchestrator
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { updateAgentRun, appendAgentLog } from '@/tree/mission/agent-run-repo';
import type { UpdateAgentRunInput } from '@/tree/mission/agent-run-repo';
import { recordSpend } from '@/tree/mission/repository';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { newPerformanceEventId, recordPerformanceEvent } from '@/tree/performance';
import { emitMissionCompleted, emitMissionFailed, advanceMissionToReview } from '../agent-mission-lifecycle';
import { persistAgentLearning } from '../agent-context';

export async function markRunFailed(
  runId: string,
  errorMessage: string,
  errorJson: Record<string, unknown>,
): Promise<void> {
  await updateAgentRun(runId, {
    status: 'failed',
    phase: 'failed',
    errorMessage,
    errorJson,
    endedAt: Math.floor(Date.now() / 1000),
  });
}

export function createAgentLogger(runId: string, initialPhase: string) {
  return (level: 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>) => {
    appendAgentLog({
      id: `${runId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      runId,
      phase: initialPhase,
      level,
      message,
      metadata,
      timestamp: Math.floor(Date.now() / 1000),
    });
  };
}

export interface MissionSuccessPayload {
  runId: string;
  agentId: string;
  missionId: string;
  creatorId: string;
  workspaceId: string;
  costCents: number;
  totalTokens: number;
  output?: unknown;
  confidence?: number;
}

export async function handleMissionSuccess(payload: MissionSuccessPayload): Promise<void> {
  const patch: UpdateAgentRunInput = {
    status: 'completed',
    phase: 'completed',
    outputJson: payload.output as Record<string, unknown> | undefined,
    totalCostCents: payload.costCents,
    totalTokens: payload.totalTokens,
    endedAt: Math.floor(Date.now() / 1000),
  };
  await updateAgentRun(payload.runId, patch);

  try {
    await recordSpend(payload.missionId, payload.costCents);
  } catch (spendErr) {
    logger.error('agentMissionExecutor: failed to record spend', {
      runId: payload.runId,
      missionId: payload.missionId,
      costCents: payload.costCents,
      error: spendErr instanceof Error ? spendErr.message : String(spendErr),
    });
  }

  try {
    const mcuAmount = Math.ceil(payload.costCents / 10);
    if (mcuAmount > 0) {
      const deducted = await deductCredits(
        payload.creatorId,
        mcuAmount,
        payload.missionId,
        'agent_mission_execution',
      );
      if (!deducted) {
        logger.warn('agentMissionExecutor: MCU credit deduction failed', {
          runId: payload.runId,
          missionId: payload.missionId,
          userId: payload.creatorId,
          mcuAmount,
        });
      }
    }
  } catch (creditErr) {
    logger.error('agentMissionExecutor: error deducting MCU credits', {
      runId: payload.runId,
      userId: payload.creatorId,
      error: creditErr instanceof Error ? creditErr.message : String(creditErr),
    });
  }

  await persistAgentLearning({
    workspaceId: payload.workspaceId,
    missionId: payload.missionId,
    agentId: payload.agentId,
    runId: payload.runId,
    confidence: payload.confidence,
    output: payload.output,
  });

  try {
    await recordPerformanceEvent({
      id: newPerformanceEventId(),
      workspaceId: payload.workspaceId,
      assetId: '',
      projectId: '',
      entityType: 'mission',
      entityId: payload.missionId,
      channel: 'agent',
      eventType: 'mission_completed',
      count: 1,
      valueCents: payload.costCents,
      rawData: { agentId: payload.agentId, totalTokens: payload.totalTokens, runId: payload.runId },
      recordedAt: Date.now(),
    });
  } catch (perfErr) {
    logger.error('agentMissionExecutor: failed to record performance event', {
      runId: payload.runId,
      error: perfErr instanceof Error ? perfErr.message : String(perfErr),
    });
  }

  await emitMissionCompleted(inngest, {
    runId: payload.runId,
    agentId: payload.agentId,
    missionId: payload.missionId,
    totalCostCents: payload.costCents,
    totalTokens: payload.totalTokens,
  });

  await advanceMissionToReview(payload.missionId);
}

export async function handleMissionFailure(
  runId: string,
  agentId: string,
  missionId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  await markRunFailed(runId, errorMessage, { code: errorCode, message: errorMessage });
  await emitMissionFailed(inngest, {
    runId,
    agentId,
    missionId,
    errorCode,
    errorMessage,
  });
}
