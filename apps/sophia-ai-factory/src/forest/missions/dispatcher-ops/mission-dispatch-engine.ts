/**
 * Core Mission Dispatch Engine
 * @module forest/missions/dispatcher-ops/mission-dispatch-engine
 */

import { createServerClient } from '@/seed/db/client';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { getCommand } from '@/tree/missions/command-registry';
import { fireMissionWebhook } from '@/forest/webhooks/missions/fire-webhook';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult } from '@/tree/missions/types';
import { clearMissionCheckpoint } from '@/tree/missions/checkpoint-persistence';
import type { MissionRow } from './types';
import { loadHandler, saveCp, loadCp, failMission } from './queue-router';

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

  // Mark running
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

  let params: Record<string, unknown> = {};
  try {
    params = mission.params ? (JSON.parse(mission.params) as Record<string, unknown>) : {};
  } catch (parseErr) {
    logger.warn('[Dispatcher] Failed to parse mission params — using empty object', {
      missionId,
      raw: mission.params?.slice(0, 200),
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
    params = {};
  }

  const creditsUsed = commandDef.credits;

  // Deduct credits BEFORE handler execution to prevent TOCTOU double-spend.
  if (creditsUsed > 0) {
    const deducted = await deductCredits(
      mission.user_id,
      creditsUsed,
      missionId,
      `command:${mission.command}`
    );
    if (!deducted) {
      logger.warn('[Dispatcher] Credit deduction failed', { missionId, creditsUsed });
      await failMission(db, missionId, 'insufficient_credits');
      return;
    }
  }

  // Load checkpoint for resume support
  const existingCheckpoint = await loadCp(db, missionId);
  const resumeTokensUsed = existingCheckpoint?.tokensUsed ?? 0;

  // Wrap handler in timeout to prevent indefinite CF Worker I/O hangs.
  const HANDLER_TIMEOUT_MS = 25_000;
  let handlerResult: MissionHandlerResult;
  try {
    handlerResult = await Promise.race([
      handler({
        missionId: mission.id,
        userId: mission.user_id,
        command: mission.command,
        params,
        checkpoint: existingCheckpoint
          ? {
              partialResult: existingCheckpoint.partialResult,
              tokensUsed: existingCheckpoint.tokensUsed,
              provider: existingCheckpoint.provider,
              model: existingCheckpoint.model,
              state: existingCheckpoint.state,
            }
          : undefined,
        onProgress: async (stepData) => {
          await saveCp(db, missionId, {
            stepOrder: stepData.stepOrder,
            stepType: stepData.stepType,
            savedAt: new Date().toISOString(),
            partialResult: stepData.partialResult,
            tokensUsed: resumeTokensUsed + (stepData.tokensUsed ?? 0),
            provider: stepData.provider,
            model: stepData.model,
            retryCount: 0,
            state: stepData.state,
          });
        },
      }),
      new Promise<MissionHandlerResult>((_, reject) =>
        setTimeout(() => reject(new Error('Mission handler timeout')), HANDLER_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Handler threw unexpected error';
    if (errMsg === 'Mission handler timeout') {
      logger.error('[Dispatcher] Mission handler timeout', { missionId });
    } else {
      logger.error('[Dispatcher] Handler threw unexpected error', { missionId, error: errMsg });
    }
    handlerResult = {
      ok: false,
      error: errMsg === 'Mission handler timeout' ? 'handler_timeout' : errMsg,
    };
  }

  const nowAfter = Math.floor(Date.now() / 1000);

  if (handlerResult.ok) {
    await db
      .from('engine_missions')
      .update({
        status: 'succeeded',
        result: JSON.stringify(handlerResult.data ?? {}),
        credits_used: creditsUsed,
        updated_at: nowAfter,
        completed_at: nowAfter,
      })
      .eq('id', missionId);
    // Clear checkpoint on success
    await clearMissionCheckpoint(missionId);
  } else {
    await failMission(db, missionId, handlerResult.error ?? 'Unknown error');
    // Keep checkpoint on failure for potential resume
  }

  // Fire webhook if configured
  if (mission.webhook_url) {
    try {
      await fireMissionWebhook(missionId, mission.webhook_url);
    } catch (err) {
      logger.error('[Dispatcher] Webhook fire failed', { missionId, err });
    }
  }

  logger.debug('[Dispatcher] Mission complete', {
    missionId,
    command: mission.command,
    ok: handlerResult.ok,
  });
}
