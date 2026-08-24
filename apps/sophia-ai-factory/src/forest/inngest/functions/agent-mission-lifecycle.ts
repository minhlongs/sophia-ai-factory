/**
 * Agent Mission Lifecycle helpers
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Closes the agent event loop: the mission executor emits completion/failure
 * events (triggering the provenance bridge) and hands successful missions to
 * human review via the single enforced transition authority in tree/mission.
 *
 * Payload shapes are imported from the canonical seed contracts — no inline
 * literals that could drift from the registered Inngest schema.
 *
 * @module forest/inngest/functions
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  AgentMissionCompletedData,
  AgentMissionFailedData,
} from '@/seed/inngest/agent-event-types';
import type { inngest } from '@/seed/inngest/client';
import { MissionError } from '@/tree/mission/types';
import { updateMissionStatus } from '@/tree/mission';

/** The seeded Inngest client type — keeps emit signatures schema-typed. */
type InngestClient = typeof inngest;

/** Emit `agent.mission.completed` (drives the provenance bridge). */
export async function emitMissionCompleted(
  client: InngestClient,
  payload: AgentMissionCompletedData['data'],
): Promise<void> {
  await client.send({ name: 'agent.mission.completed', data: payload });
}

/** Emit `agent.mission.failed` (audit trail; mission status is never touched here). */
export async function emitMissionFailed(
  client: InngestClient,
  payload: AgentMissionFailedData['data'],
): Promise<void> {
  await client.send({ name: 'agent.mission.failed', data: payload });
}

/**
 * Advance a successful mission to 'review' — the machine hands artifacts to
 * a human reviewer and never self-completes a mission.
 *
 * Non-fatal by design: a rejected transition (e.g. concurrent human edit)
 * is logged and swallowed so the run outcome is not masked. Unexpected
 * infrastructure errors propagate for visibility.
 */
export async function advanceMissionToReview(missionId: string): Promise<{ advanced: boolean }> {
  try {
    await updateMissionStatus(missionId, 'review', 'review');
    return { advanced: true };
  } catch (err) {
    if (!(err instanceof MissionError)) throw err;
    logger.warn('agentMissionLifecycle: advance-to-review rejected (non-fatal)', {
      missionId,
      code: err.code,
      message: err.message,
    });
    return { advanced: false };
  }
}
