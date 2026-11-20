/**
 * Mission State Helpers (Load, Parse Params, Finalize)
 * @module forest/missions/dispatcher-ops/mission-state-helpers
 */

import type { createServerClient } from '@/seed/db/client';
import { fireMissionWebhook } from '@/forest/webhooks/missions/fire-webhook';
import { logger } from '@/seed/utils/logger-utility';
import { clearMissionCheckpoint } from '@/tree/missions/checkpoint-persistence';
import type { MissionRow } from './types';

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

  try {
    const terminal = handlerResult.ok
      ? await db.prepare(`UPDATE engine_missions SET status='succeeded', result=?, credits_used=?,
          updated_at=?, completed_at=? WHERE id=? AND user_id=? AND status='running' RETURNING id`)
        .bind(JSON.stringify(handlerResult.data ?? {}), creditsUsed, nowAfter, nowAfter, missionId, mission.user_id)
        .first<{ id: string }>()
      : await db.prepare(`UPDATE engine_missions SET status='failed', error=?, updated_at=?, completed_at=?
          WHERE id=? AND user_id=? AND status='running' RETURNING id`)
        .bind(handlerResult.error ?? 'Unknown error', nowAfter, nowAfter, missionId, mission.user_id)
        .first<{ id: string }>();
    if (!terminal) return;
    if (handlerResult.ok) await clearMissionCheckpoint(missionId);
  } catch (err) {
    logger.error('[Dispatcher] Failed to finalize mission', { missionId, err });
    return;
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
