/**
 * Core Mission Dispatch Engine
 * @module forest/missions/dispatcher-ops/mission-dispatch-engine
 */

import { createServerClient } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/org-resolver';
import { deductMissionCredits } from '@/tree/mcu/credits-repo';
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
    const claimed = await db.prepare(`UPDATE engine_missions SET status='running', updated_at=strftime('%s','now')
      WHERE id=? AND user_id=? AND status='pending' RETURNING id`)
      .bind(missionId, mission.user_id).first<{ id: string }>();
    if (!claimed) return;
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
  let resolvedOrgId: string | null = null;
  try {
    resolvedOrgId = await resolveOrgId(mission.user_id);
  } catch (err) {
    logger.error('[Dispatcher] Failed to resolve trusted orgId', { missionId, err });
    await failMission(db, missionId, 'org_resolution_failed');
    return;
  }

  const callerOrgIds = [params.orgId, params.org_id]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim());
  if (callerOrgIds.some((id) => id !== resolvedOrgId)) {
    logger.warn('[Dispatcher] Rejected spoofed caller orgId', { missionId, userId: mission.user_id });
    await failMission(db, missionId, 'unauthorized_org');
    return;
  }

  const sanitizedParams: Record<string, unknown> = { ...params };
  if (resolvedOrgId) {
    sanitizedParams.orgId = resolvedOrgId;
    sanitizedParams.org_id = resolvedOrgId;
  } else {
    delete sanitizedParams.orgId;
    delete sanitizedParams.org_id;
  }

  const creditsUsed = commandDef.credits;

  if (creditsUsed > 0) {
    const deduction = await deductMissionCredits(
      mission.user_id,
      creditsUsed,
      missionId,
      `command:${mission.command}`,
      resolvedOrgId ?? undefined,
    );
    if (!deduction.ok) {
      logger.error('[Dispatcher] Mission credit deduction uncertain; deferring to reaper', {
        missionId,
        creditsUsed,
        code: deduction.error.code,
        message: deduction.error.message,
      });
      if (deduction.error.code === 'invalid_input') {
        await finalizeMissionExecution({
          db, mission: { ...mission, webhook_url: null }, creditsUsed: 0,
          handlerResult: { ok: false, error: 'invalid_credit_debit' },
        });
      }
      return;
    }
    if (!deduction.value) {
      logger.warn('[Dispatcher] Credit deduction failed', { missionId, creditsUsed });
      await finalizeMissionExecution({
        db, mission: { ...mission, webhook_url: null }, creditsUsed: 0,
        handlerResult: { ok: false, error: 'insufficient_credits' },
      });
      return;
    }
  }

  const handlerResult = await executeMissionHandlerWithTimeout({
    db,
    mission,
    handler,
    parsedParams: sanitizedParams,
    orgId: resolvedOrgId ?? undefined,
  });

  await finalizeMissionExecution({
    db,
    mission,
    creditsUsed,
    handlerResult,
  });
}
