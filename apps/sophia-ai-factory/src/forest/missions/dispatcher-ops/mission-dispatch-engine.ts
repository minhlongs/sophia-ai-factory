/**
 * Core Mission Dispatch Engine
 * @module forest/missions/dispatcher-ops/mission-dispatch-engine
 */

import { createServerClient } from '@/seed/db/client';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { getCommand } from '@/tree/missions/command-registry';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionRow } from './types';
import { loadHandler, failMission } from './queue-router';
import { executeMissionHandlerWithTimeout } from './mission-handler-runner';
import {
  parseMissionParams,
  finalizeMissionExecution,
} from './mission-state-helpers';

/**
 * Execute a mission asynchronously.
 * Safe to call from Workers waitUntil — never throws.
 */
export async function dispatchMission(missionId: string): Promise<void> {
  const db = createServerClient();

  let mission: MissionRow | null = null;
  try {
    const { data } = (await db
      .from('engine_missions')
      .select('id, user_id, command, params, status, webhook_url')
      .eq('id', missionId)
      .single()) as { data: MissionRow | null; error: unknown };
    mission = data;
  } catch (err) {
    logger.error('[Dispatcher] Failed to load mission', { missionId, err });
    return;
  }

  if (!mission) {
    logger.error('[Dispatcher] Mission not found', { missionId });
    return;
  }

  if (mission.status !== 'pending') {
    logger.debug('[Dispatcher] Mission already dispatched', { missionId, status: mission.status });
    return;
  }

  try {
    await db
      .from('engine_missions')
      .update({ status: 'running', updated_at: Math.floor(Date.now() / 1000) })
      .eq('id', missionId)
      .eq('status', 'pending');
  } catch (err) {
    logger.error('[Dispatcher] Failed to mark running', { missionId, err });
    return;
  }

  const commandDef = getCommand(mission.command);
  const handler = await loadHandler(mission.command);

  if (!commandDef) {
    await failMission(db, missionId, `Unknown command: ${mission.command}`);
    return;
  }

  if (!handler) {
    await failMission(db, missionId, `Handler module failed to load for command: ${mission.command}`);
    return;
  }

  const params = parseMissionParams(missionId, mission.params);
  const creditsUsed = commandDef.credits;

  if (creditsUsed > 0) {
    const deducted = await deductCredits(
      mission.user_id,
      creditsUsed,
      missionId,
      `command:${mission.command}`,
    );
    if (!deducted) {
      logger.warn('[Dispatcher] Credit deduction failed', { missionId, creditsUsed });
      await failMission(db, missionId, 'insufficient_credits');
      return;
    }
  }

  const handlerResult = await executeMissionHandlerWithTimeout({
    db,
    mission,
    handler,
    parsedParams: params,
  });

  await finalizeMissionExecution({
    db,
    mission,
    creditsUsed,
    handlerResult,
  });
}
