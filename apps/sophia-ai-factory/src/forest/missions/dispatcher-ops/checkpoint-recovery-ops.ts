/**
 * Mission checkpoint persistence and stuck mission recovery
 * @module forest/missions/dispatcher-ops/checkpoint-recovery-ops
 */

import { createServerClient, type D1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionCheckpoint } from './types';

/**
 * Mark a mission as failed with error and completion timestamp.
 */
export async function failMission(db: D1Client, missionId: string, error: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .from('engine_missions')
    .update({ status: 'failed', error, updated_at: now, completed_at: now })
    .eq('id', missionId);
}

/**
 * Save mission checkpoint with size capping (48KB)
 */
export async function saveCp(db: D1Client, missionId: string, cp: MissionCheckpoint): Promise<void> {
  try {
    const json = JSON.stringify(cp);
    if (json.length > 48 * 1024) {
      const trimmed: MissionCheckpoint = {
        ...cp,
        state: undefined,
        partialResult: cp.partialResult
          ? Object.fromEntries(Object.entries(cp.partialResult).slice(0, 20))
          : undefined,
      };
      const trimmedJson = JSON.stringify(trimmed);
      if (trimmedJson.length > 48 * 1024) {
        logger.warn('[Dispatcher] Checkpoint too large after trim, skipping save', {
          missionId,
          size: trimmedJson.length,
        });
        return;
      }
      await db
        .from('engine_missions')
        .update({ checkpoint_json: trimmedJson, updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', missionId);
      return;
    }
    await db
      .from('engine_missions')
      .update({ checkpoint_json: json, updated_at: Math.floor(Date.now() / 1000) })
      .eq('id', missionId);
  } catch (err) {
    logger.warn('[Dispatcher] Checkpoint save failed', {
      missionId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Load checkpoint for mission resume
 */
export async function loadCp(db: D1Client, missionId: string): Promise<MissionCheckpoint | null> {
  try {
    const { data } = (await db
      .from('engine_missions')
      .select('checkpoint_json')
      .eq('id', missionId)
      .single()) as { data: { checkpoint_json: string | null } | null };
    if (data?.checkpoint_json) {
      return JSON.parse(data.checkpoint_json) as MissionCheckpoint;
    }
  } catch {
    // Column may not exist yet (pre-migration) — graceful fallback
  }
  return null;
}

/**
 * Detect missions stuck in 'running' state beyond the timeout threshold.
 * Called by a cron job to recover orphaned dispatches.
 */
export async function recoverStuckMissions(stuckThresholdSeconds = 300): Promise<number> {
  const db = createServerClient();
  const cutoff = Math.floor(Date.now() / 1000) - stuckThresholdSeconds;
  try {
    const { data } = await db
      .from('engine_missions')
      .select('id')
      .eq('status', 'running')
      .lt('updated_at', cutoff)
      .limit(50);
    const stuck = (data as { id: string }[] | null) ?? [];
    for (const m of stuck) {
      await failMission(db, m.id, 'stuck:recovered_by_reaper');
    }
    if (stuck.length) {
      logger.info('[Dispatcher] Recovered stuck missions', { count: stuck.length });
    }
    return stuck.length;
  } catch (err) {
    logger.error('[Dispatcher] recoverStuckMissions failed', { err });
    return 0;
  }
}
