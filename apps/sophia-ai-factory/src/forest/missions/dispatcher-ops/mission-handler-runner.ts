/**
 * Timeout-wrapped handler execution and checkpoint persistence for mission dispatcher.
 * @module forest/missions/dispatcher-ops/mission-handler-runner
 */

import type { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult } from '@/tree/missions/types';
import type { MissionRow } from './types';
import { loadHandler, saveCp, loadCp } from './queue-router';

const HANDLER_TIMEOUT_MS = 25_000;

export async function executeMissionHandlerWithTimeout(params: {
  db: ReturnType<typeof createServerClient>;
  mission: MissionRow;
  handler: NonNullable<Awaited<ReturnType<typeof loadHandler>>>;
  parsedParams: Record<string, unknown>;
}): Promise<MissionHandlerResult> {
  const { db, mission, handler, parsedParams } = params;
  const missionId = mission.id;

  const existingCheckpoint = await loadCp(db, missionId);
  const resumeTokensUsed = existingCheckpoint?.tokensUsed ?? 0;

  try {
    return await Promise.race([
      handler({
        missionId: mission.id,
        userId: mission.user_id,
        command: mission.command,
        params: parsedParams,
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
        setTimeout(() => reject(new Error('Mission handler timeout')), HANDLER_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Handler threw unexpected error';
    if (errMsg === 'Mission handler timeout') {
      logger.error('[Dispatcher] Mission handler timeout', { missionId });
    } else {
      logger.error('[Dispatcher] Handler threw unexpected error', { missionId, error: errMsg });
    }
    return {
      ok: false,
      error: errMsg === 'Mission handler timeout' ? 'handler_timeout' : errMsg,
    };
  }
}
