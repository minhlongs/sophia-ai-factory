import { emit } from '@/land/openclaw/event-bus';
import { spawnAgentFleet } from '@/tree/agent-fleet/spawn-agent-fleet';
import { canAutoDispatch } from '@/tree/sop/auto-dispatch-layer';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { AUTOMATION_EVENTS, type MissionPayload } from './types';

/**
 * Primary dispatch hook: when a mission is created, attempt auto-dispatch.
 * Runs `canAutoDispatch` (which calls `classifyMission`) and, on success,
 * calls `spawnAgentFleet` with the recommended fleet.
 */
export async function handleMissionCreated(payload: MissionPayload): Promise<void> {
  const { missionId, missionText, tenantId, triggeredBy } = payload;
  logger.info('automation: mission created, attempting auto-dispatch', {
    missionId,
    triggeredBy,
  });

  // 1. Ask the auto-dispatch layer whether this mission is a known type.
  const decision = await canAutoDispatch(missionText);

  if (!decision?.canAuto) {
    logger.info('automation: mission requires human intervention', {
      missionId,
      missionType: decision?.missionType ?? 'unknown',
      agentFleet: [],
    });
    return;
  }

  // 2. Dispatch to the recommended fleet.
  const { agentFleet, missionType } = decision;
  logger.info('automation: dispatching fleet', {
    missionId,
    missionType,
    agentFleet,
  });

  try {
    const agentTasks = agentFleet.map((agentName, idx) => ({
      id: `${agentName}-${missionId.slice(0, 8)}-${idx}`,
      prompt: `[AUTO] Handle mission ${missionId} of type ${missionType} on behalf of tenant ${tenantId}. Mission: ${missionText.slice(0, 1000)}`,
    }));

    const results = await spawnAgentFleet(agentTasks, {
      tenantId,
      parallel: true,
    });

    // 3. Emit dispatch audit event.
    await emit(AUTOMATION_EVENTS.MISSION_DISPATCHED, tenantId, {
      missionId,
      missionType,
      agentFleet,
      successCount: results.filter((r) => r.success).length,
      total: results.length,
      triggeredBy,
    });

    logger.info('automation: dispatch complete', {
      missionId,
      successCount: results.filter((r) => r.success).length,
      total: results.length,
    });
  } catch (err) {
    logger.error('automation: fleet dispatch failed', {
      missionId,
      error: getErrorMessage(err),
    });
    // Swallow — the mission record still exists; human can retry.
  }
}

/**
 * Audit-only hook: logs every dispatch for observability / compliance.
 */
export async function handleMissionDispatched(payload: MissionPayload & Record<string, unknown>): Promise<void> {
  // In production this would write to D1 / analytics store.
  logger.info('automation: audit dispatch', {
    missionId: payload.missionId,
    tenantId: payload.tenantId,
  });
}

/**
 * Record automation outcome hook: updates success/failure counters
 * that feed `getAutomationCoverage()`.
 */
export async function handleAutomationRan(payload: Record<string, unknown>): Promise<void> {
  // In production this would update a D1 automation_metrics table.
  logger.info('automation: outcome recorded', { payload });
}
