/**
 * Step orchestrator and lifecycle helpers for agent runs.
 * @module forest/inngest/functions/agent-ops/step-orchestrator
 */

import { inngest } from '@/seed/inngest/client';
import { updateAgentRun, appendAgentLog } from '@/tree/mission/agent-run-repo';
import type { UpdateAgentRunInput } from '@/tree/mission/agent-run-repo';
import { emitMissionCompleted, emitMissionFailed, advanceMissionToReview } from '../agent-mission-lifecycle';
import { persistAgentLearning } from '../agent-context';
import {
  recordMissionSpendAndCredits,
  recordMissionPerformanceEvent,
} from './step-billing-helpers';

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

  await recordMissionSpendAndCredits(payload);

  await persistAgentLearning({
    workspaceId: payload.workspaceId,
    missionId: payload.missionId,
    agentId: payload.agentId,
    runId: payload.runId,
    confidence: payload.confidence,
    output: payload.output,
  });

  await recordMissionPerformanceEvent(payload);

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
