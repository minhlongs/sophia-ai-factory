/**
 * Queue routing, handler loading, checkpoint persistence, and stuck mission recovery
 * @module forest/missions/dispatcher-ops/queue-router
 */

import { createServerClient, type D1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from '@/tree/missions/types';
import type { MissionCheckpoint } from './types';

type MissionHandler = (ctx: MissionContext) => Promise<MissionHandlerResult>;

/**
 * Lazy-load handlers to keep bundle splits clean.
 */
export async function loadHandler(command: string): Promise<MissionHandler | null> {
  try {
    switch (command) {
      case 'ai:write': return (await import('@/forest/ai/missions/ai-write')).handle;
      case 'social:publish': return (await import('@/forest/publishing/missions/social-publish')).handle;
      case 'video:create': return (await import('@/forest/video/missions/video-create')).handle;
      case 'video:create_heygen': return (await import('@/forest/video/missions/video-create')).handle;
      case 'video:status': return (await import('@/forest/video/missions/video-status')).handle;
      case 'proposal:create': return (await import('@/forest/workflows/missions/proposal-create')).handle;
      case 'proposal:list': return (await import('@/forest/workflows/missions/proposal-list')).handle;
      case 'lead:find': return (await import('@/forest/leads/missions/lead-find')).handle;
      case 'lead:enrich': return (await import('@/forest/leads/missions/lead-enrich')).handle;
      case 'lead:export': return (await import('@/forest/leads/missions/lead-export')).handle;
      case 'email:campaign': return (await import('@/tree/email/missions/email-campaign')).handle;
      case 'email:test': return (await import('@/tree/email/missions/email-test')).handle;
      case 'email:templates': return (await import('@/tree/email/missions/email-templates')).handle;
      case 'campaign:run': return (await import('@/forest/missions/campaign-run')).handle;
      case 'youtube:publish': return (await import('@/forest/youtube/missions/youtube-publish')).handle;
      case 'youtube:list-channels': return (await import('@/forest/youtube/missions/youtube-list-channels')).handle;
      case 'voice:clone': return (await import('@/forest/voice/missions/voice-clone')).handle;
      case 'avatar:create-did': return (await import('@/forest/did/missions/avatar-create-did')).handle;
      case 'subtitle:generate': return (await import('@/forest/video/missions/subtitle-generate')).handle;
      case 'analytics:report': return (await import('@/forest/analytics/missions/analytics-report')).handle;
      case 'webhook:test': return (await import('@/forest/webhooks/missions/webhook-test')).handle;
      default: return null;
    }
  } catch (err) {
    logger.error('[Dispatcher] Failed to load handler', { command, err: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

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
