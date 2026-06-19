/**
 * Mission Dispatcher
 *
 * Reads a pending mission from engine_missions, sets status to 'running',
 * routes to the correct handler, updates the row with result/error/credits,
 * and fires the webhook if configured.
 *
 * Phase 01 (OpenMontage port): Checkpoint persistence — save/load intermediate
 * state so interrupted missions can resume instead of restarting.
 *
 * Designed for use with Workers executionCtx.waitUntil().
 */

import { createServerClient, type D1Client } from '@/seed/db/client';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { getCommand } from '@/tree/missions/command-registry';
import { fireMissionWebhook } from '@/forest/webhooks/missions/fire-webhook';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from '@/tree/missions/types';
import { clearMissionCheckpoint, loadMissionCheckpoint, saveMissionCheckpoint } from '@/tree/missions/checkpoint-persistence';

// ── Checkpoint persistence (inline for dispatcher) ─────────────────────────────

interface MissionCheckpoint {
  stepOrder: number;
  stepType: string;
  savedAt: string;
  partialResult?: Record<string, unknown>;
  tokensUsed?: number;
  provider?: string;
  model?: string;
  retryCount: number;
  state?: Record<string, unknown>;
}

async function saveCp(db: D1Client, missionId: string, cp: MissionCheckpoint): Promise<void> {
  try {
    const json = JSON.stringify(cp);
    if (json.length > 48 * 1024) {
      const trimmed: MissionCheckpoint = { ...cp, state: undefined, partialResult: cp.partialResult ? Object.fromEntries(Object.entries(cp.partialResult).slice(0, 20)) : undefined };
      const trimmedJson = JSON.stringify(trimmed);
      if (trimmedJson.length > 48 * 1024) {
        logger.warn('[Dispatcher] Checkpoint too large after trim, skipping save', { missionId, size: trimmedJson.length });
        return;
      }
      await db.from('engine_missions').update({ checkpoint_json: trimmedJson, updated_at: Math.floor(Date.now() / 1000) }).eq('id', missionId);
      return;
    }
    await db.from('engine_missions').update({ checkpoint_json: json, updated_at: Math.floor(Date.now() / 1000) }).eq('id', missionId);
  } catch (err) {
    logger.warn('[Dispatcher] Checkpoint save failed', { missionId, err: err instanceof Error ? err.message : String(err) });
  }
}

async function loadCp(db: D1Client, missionId: string): Promise<MissionCheckpoint | null> {
  try {
    const { data } = await db.from('engine_missions').select('checkpoint_json').eq('id', missionId).single() as { data: { checkpoint_json: string | null } | null };
    if (data?.checkpoint_json) {
      return JSON.parse(data.checkpoint_json) as MissionCheckpoint;
    }
  } catch {
    // Column may not exist yet (pre-migration) — graceful fallback
  }
  return null;
}

// ── Handler loading ────────────────────────────────────────────────────────────

// Lazy-load handlers to keep bundle splits clean
async function loadHandler(command: string): Promise<((ctx: MissionContext) => Promise<MissionHandlerResult>) | null> {
  try {
    switch (command) {
      case 'ai:write': return (await import('../ai/missions/ai-write')).handle;
      case 'social:publish': return (await import('../publishing/missions/social-publish')).handle;
      case 'video:create': return (await import('../video/missions/video-create')).handle;
      case 'video:create_heygen': return (await import('../video/missions/video-create')).handle;
      case 'video:status': return (await import('../video/missions/video-status')).handle;
      case 'proposal:create': return (await import('../workflows/missions/proposal-create')).handle;
      case 'proposal:list': return (await import('../workflows/missions/proposal-list')).handle;
      case 'lead:find': return (await import('../leads/missions/lead-find')).handle;
      case 'lead:enrich': return (await import('../leads/missions/lead-enrich')).handle;
      case 'lead:export': return (await import('../leads/missions/lead-export')).handle;
      case 'email:campaign': return (await import('../../tree/email/missions/email-campaign')).handle;
      case 'email:test': return (await import('../../tree/email/missions/email-test')).handle;
      case 'email:templates': return (await import('../../tree/email/missions/email-templates')).handle;
      case 'campaign:run': return (await import('../../tree/email/missions/campaign-run')).handle;
      case 'youtube:publish': return (await import('../youtube/missions/youtube-publish')).handle;
      case 'youtube:list-channels': return (await import('../youtube/missions/youtube-list-channels')).handle;
      case 'voice:clone': return (await import('../voice/missions/voice-clone')).handle;
      case 'avatar:create-did': return (await import('../did/missions/avatar-create-did')).handle;
      case 'subtitle:generate': return (await import('../video/missions/subtitle-generate')).handle;
      case 'analytics:report': return (await import('../analytics/missions/analytics-report')).handle;
      case 'webhook:test': return (await import('../webhooks/missions/webhook-test')).handle;
      default: return null;
    }
  } catch (err) {
    logger.error('[Dispatcher] Failed to load handler', { command, err: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface MissionRow {
  id: string;
  user_id: string;
  command: string;
  params: string | null;
  status: string;
  webhook_url: string | null;
}

// ── dispatchMission ────────────────────────────────────────────────────────────

/**
 * Execute a mission asynchronously.
 * Safe to call from Workers waitUntil — never throws.
 */
export async function dispatchMission(missionId: string): Promise<void> {
  const db = createServerClient();

  let mission: MissionRow | null = null;
  try {
    const { data } = await db
      .from('engine_missions')
      .select('id, user_id, command, params, status, webhook_url')
      .eq('id', missionId)
      .single() as { data: MissionRow | null; error: unknown };
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
    await db
      .from('engine_missions')
      .update({ status: 'failed', error: `Unknown command: ${mission.command}`, updated_at: Math.floor(Date.now() / 1000), completed_at: Math.floor(Date.now() / 1000) })
      .eq('id', missionId);
    return;
  }

  if (!handler) {
    await db
      .from('engine_missions')
      .update({ status: 'failed', error: `Handler module failed to load for command: ${mission.command}`, updated_at: Math.floor(Date.now() / 1000), completed_at: Math.floor(Date.now() / 1000) })
      .eq('id', missionId);
    return;
  }

  let params: Record<string, unknown> = {};
  try {
    params = mission.params ? (JSON.parse(mission.params) as Record<string, unknown>) : {};
  } catch (parseErr) {
    logger.warn("[Dispatcher] Failed to parse mission params — using empty object", {
      missionId,
      raw: mission.params?.slice(0, 200),
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
    params = {};
  }

  const creditsUsed = commandDef.credits;

  // R2-6: Deduct credits BEFORE handler execution to prevent TOCTOU double-spend.
  if (creditsUsed > 0) {
    const deducted = await deductCredits(mission.user_id, creditsUsed, missionId, `command:${mission.command}`);
    if (!deducted) {
      logger.warn('[Dispatcher] Credit deduction failed', { missionId, creditsUsed });
      await db
        .from('engine_missions')
        .update({ status: 'failed', error: 'insufficient_credits', updated_at: Math.floor(Date.now() / 1000), completed_at: Math.floor(Date.now() / 1000) })
        .eq('id', missionId);
      return;
    }
  }

  // Phase 01: Load checkpoint for resume support
  const existingCheckpoint = await loadCp(db, missionId);
  const resumeTokensUsed = existingCheckpoint?.tokensUsed ?? 0;

  // R2-10: Wrap handler in timeout to prevent indefinite CF Worker I/O hangs.
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
    handlerResult = {
      ok: false,
      error: errMsg === 'Mission handler timeout' ? 'handler_timeout' : errMsg,
    };
  }

  const nowAfter = Math.floor(Date.now() / 1000);

  if (handlerResult.ok) {
    await db
      .from('engine_missions')
      .update({ status: 'succeeded', result: JSON.stringify(handlerResult.data ?? {}), credits_used: creditsUsed, updated_at: nowAfter, completed_at: nowAfter })
      .eq('id', missionId);
    // Clear checkpoint on success
    await clearMissionCheckpoint(missionId);
  } else {
    await db
      .from('engine_missions')
      .update({ status: 'failed', error: handlerResult.error ?? 'Unknown error', updated_at: nowAfter, completed_at: nowAfter })
      .eq('id', missionId);
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

  logger.debug('[Dispatcher] Mission complete', { missionId, command: mission.command, ok: handlerResult.ok });
}

// ── Stuck mission recovery ─────────────────────────────────────────────────────

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
      await db.from('engine_missions').update({
        status: 'failed',
        error: 'stuck:recovered_by_reaper',
        updated_at: Math.floor(Date.now() / 1000),
        completed_at: Math.floor(Date.now() / 1000),
      }).eq('id', m.id);
    }
    if (stuck.length) logger.info('[Dispatcher] Recovered stuck missions', { count: stuck.length });
    return stuck.length;
  } catch (err) {
    logger.error('[Dispatcher] recoverStuckMissions failed', { err });
    return 0;
  }
}
