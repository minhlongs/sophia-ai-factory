/**
 * Mission State Helpers (Load, Parse Params, Finalize)
 * @module forest/missions/dispatcher-ops/mission-state-helpers
 */

import type { createServerClient } from '@/seed/db/client';
import { fireMissionWebhook } from '@/forest/webhooks/missions/fire-webhook';
import { logger } from '@/seed/utils/logger-utility';
import { clearMissionCheckpoint } from '@/tree/missions/checkpoint-persistence';
import type { MissionRow } from './types';
import { failMission } from './queue-router';

type ServerDbClient = ReturnType<typeof createServerClient>;

export function parseMissionParams(
  missionId: string,
  rawParams: string | null | undefined,
): Record<string, unknown> {
  try {
    return rawParams ? (JSON.parse(rawParams) as Record<string, unknown>) : {};
  } catch (parseErr) {
    logger.warn('[Dispatcher] Failed to parse mission params — using empty object', {
      missionId,
      raw: rawParams?.slice(0, 200),
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
    return {};
  }
}

export async function finalizeMissionExecution(params: {
  db: ServerDbClient;
  mission: MissionRow;
  creditsUsed: number;
  handlerResult: { ok: boolean; data?: unknown; error?: string };
}): Promise<void> {
  const { db, mission, creditsUsed, handlerResult } = params;
  const missionId = mission.id;
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
    await clearMissionCheckpoint(missionId);
  } else {
    await failMission(db, missionId, handlerResult.error ?? 'Unknown error');
  }

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
