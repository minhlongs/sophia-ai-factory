/**
 * Checkpoint Persistence — save/load workflow step state to engine_missions.checkpoint_json
 *
 * Ported from OpenMontage checkpoint pattern. Allows mission dispatcher to resume
 * interrupted steps instead of restarting from scratch.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  createCheckpoint,
  deserializeCheckpoint,
  serializeCheckpoint,
  MAX_CHECKPOINT_BYTES,
} from '../workflows/checkpoint';

export interface CheckpointData {
  stepOrder: number;
  stepType: string;
  partialResult?: Record<string, unknown>;
  tokensUsed?: number;
  provider?: string;
  model?: string;
  state?: Record<string, unknown>;
}

/**
 * Save checkpoint to engine_missions.checkpoint_json
 */
export async function saveMissionCheckpoint(
  missionId: string,
  data: CheckpointData,
): Promise<boolean> {
  try {
    const db = createServerClient();
    const cp = createCheckpoint(missionId, '', data.stepOrder, data.stepType, {
      partialResult: data.partialResult,
      tokensUsed: data.tokensUsed,
      provider: data.provider,
      model: data.model,
      state: data.state,
    });
    const json = serializeCheckpoint(cp);

    await db
      .from('engine_missions')
      .update({ checkpoint_json: json, updated_at: Math.floor(Date.now() / 1000) })
      .eq('id', missionId);

    return true;
  } catch (err) {
    logger.error('[Checkpoint] Failed to save', { missionId, err });
    return false;
  }
}

/**
 * Load checkpoint from engine_missions.checkpoint_json
 * Returns null if no checkpoint exists or deserialization fails.
 */
export async function loadMissionCheckpoint(
  missionId: string,
): Promise<ReturnType<typeof deserializeCheckpoint>> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('engine_missions')
      .select('checkpoint_json')
      .eq('id', missionId)
      .single();

    const json = (data as { checkpoint_json: string | null } | null)?.checkpoint_json;
    if (!json) return null;

    return deserializeCheckpoint(json);
  } catch {
    return null;
  }
}

/**
 * Clear checkpoint after successful completion (cleanup).
 */
export async function clearMissionCheckpoint(missionId: string): Promise<void> {
  try {
    const db = createServerClient();
    await db
      .from('engine_missions')
      .update({ checkpoint_json: null, updated_at: Math.floor(Date.now() / 1000) })
      .eq('id', missionId);
  } catch (err) {
    logger.warn('[Checkpoint] Failed to clear', { missionId, err });
  }
}
