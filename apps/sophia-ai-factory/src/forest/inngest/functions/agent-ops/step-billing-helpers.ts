/**
 * Billing and performance recording helpers for agent mission runs.
 * @module forest/inngest/functions/agent-ops/step-billing-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { recordSpend } from '@/tree/mission/repository';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { newPerformanceEventId, recordPerformanceEvent } from '@/tree/performance';

export interface MissionBillingAndPerfInput {
  runId: string;
  agentId: string;
  missionId: string;
  creatorId: string;
  workspaceId: string;
  costCents: number;
  totalTokens: number;
}

export async function recordMissionSpendAndCredits(
  input: MissionBillingAndPerfInput,
): Promise<void> {
  try {
    await recordSpend(input.missionId, input.costCents);
  } catch (spendErr) {
    logger.error('agentMissionExecutor: failed to record spend', {
      runId: input.runId,
      missionId: input.missionId,
      costCents: input.costCents,
      error: spendErr instanceof Error ? spendErr.message : String(spendErr),
    });
  }

  try {
    const mcuAmount = Math.ceil(input.costCents / 10);
    if (mcuAmount > 0) {
      const deducted = await deductCredits(
        input.creatorId,
        mcuAmount,
        input.missionId,
        'agent_mission_execution',
      );
      if (!deducted) {
        logger.warn('agentMissionExecutor: MCU credit deduction failed', {
          runId: input.runId,
          missionId: input.missionId,
          userId: input.creatorId,
          mcuAmount,
        });
      }
    }
  } catch (creditErr) {
    logger.error('agentMissionExecutor: error deducting MCU credits', {
      runId: input.runId,
      userId: input.creatorId,
      error: creditErr instanceof Error ? creditErr.message : String(creditErr),
    });
  }
}

export async function recordMissionPerformanceEvent(
  input: MissionBillingAndPerfInput,
): Promise<void> {
  try {
    await recordPerformanceEvent({
      id: newPerformanceEventId(),
      workspaceId: input.workspaceId,
      assetId: '',
      projectId: '',
      entityType: 'mission',
      entityId: input.missionId,
      channel: 'agent',
      eventType: 'mission_completed',
      count: 1,
      valueCents: input.costCents,
      rawData: {
        agentId: input.agentId,
        totalTokens: input.totalTokens,
        runId: input.runId,
      },
      recordedAt: Date.now(),
    });
  } catch (perfErr) {
    logger.error('agentMissionExecutor: failed to record performance event', {
      runId: input.runId,
      error: perfErr instanceof Error ? perfErr.message : String(perfErr),
    });
  }
}
